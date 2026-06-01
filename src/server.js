import { createServer } from "node:http";
import { loadConfig } from "./config.js";
import { createOpenAICompatibleAdapter } from "./adapters/openai-compatible.js";

const { config, path: configPath } = loadConfig();
const adapters = buildAdapters(config);
const modelToAdapter = new Map();
for (const adapter of adapters) {
  for (const model of adapter.models) modelToAdapter.set(model.id, adapter);
}

function buildAdapters(config) {
  const result = [];
  for (const [name, adapterConfig] of Object.entries(config.adapters || {})) {
    if (!adapterConfig?.enabled) continue;
    if (adapterConfig.type && adapterConfig.type !== "openai-compatible") continue;
    result.push(createOpenAICompatibleAdapter(name, adapterConfig));
  }
  return result;
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

function isAuthorized(req) {
  const keys = config.gatewayApiKeys || [];
  if (keys.length === 0) return true;
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return keys.includes(token);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

function copyHeaders(from, res) {
  const skip = new Set(["content-encoding", "content-length", "transfer-encoding", "connection"]);
  for (const [key, value] of from.headers.entries()) {
    if (!skip.has(key.toLowerCase())) res.setHeader(key, value);
  }
}

async function proxyResponse(upstream, res) {
  res.statusCode = upstream.status;
  copyHeaders(upstream, res);
  if (!res.getHeader("content-type")) res.setHeader("content-type", "application/json");

  if (!upstream.body) {
    res.end(await upstream.text());
    return;
  }

  const reader = upstream.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
  } finally {
    res.end();
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (url.pathname === "/health") {
      return sendJson(res, 200, {
        ok: true,
        configPath,
        adapters: adapters.map((a) => a.name),
        models: [...modelToAdapter.keys()],
      });
    }

    if (!isAuthorized(req)) {
      return sendJson(res, 401, { error: { message: "Unauthorized", type: "unauthorized" } });
    }

    if (req.method === "GET" && url.pathname === "/v1/models") {
      return sendJson(res, 200, {
        object: "list",
        data: adapters.flatMap((adapter) => adapter.models.map(({ upstreamModel, name, ...model }) => model)),
      });
    }

    if (req.method === "POST" && (url.pathname === "/v1/chat/completions" || url.pathname === "/v1/responses")) {
      const body = await readJson(req);
      if (!body.model) {
        return sendJson(res, 400, { error: { message: "Missing model", type: "invalid_request_error" } });
      }

      const adapter = modelToAdapter.get(body.model) || adapters.find((a) => a.canHandle(body.model));
      if (!adapter) {
        return sendJson(res, 404, {
          error: {
            message: `No adapter configured for model '${body.model}'`,
            type: "model_not_found",
          },
        });
      }

      const upstream = await adapter.proxy(url.pathname, body, req.headers);
      return proxyResponse(upstream, res);
    }

    return sendJson(res, 404, { error: { message: "Not found", type: "not_found" } });
  } catch (error) {
    return sendJson(res, 500, {
      error: {
        message: error instanceof Error ? error.message : String(error),
        type: "gateway_error",
      },
    });
  }
});

server.listen(config.port, config.host, () => {
  console.log(`Warp Gateway listening on http://${config.host}:${config.port}`);
  console.log(`Config: ${configPath}`);
  console.log(`Models: ${[...modelToAdapter.keys()].join(", ") || "none"}`);
});
