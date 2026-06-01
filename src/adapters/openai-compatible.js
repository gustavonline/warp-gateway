import { resolveSecret } from "../config.js";

function normalizeConfiguredModel(name, model) {
  return {
    id: model.id,
    object: "model",
    created: 0,
    owned_by: name,
    name: model.name || model.id,
    upstreamModel: model.upstreamModel || model.id.replace(`${name}/`, ""),
  };
}

function normalizeDiscoveredModel(name, prefix, upstream) {
  const upstreamId = upstream.id || upstream.name || upstream.model || upstream.model_name;
  if (!upstreamId) return undefined;
  const publicId = upstreamId.startsWith(`${prefix}/`) ? upstreamId : `${prefix}/${upstreamId}`;
  return {
    id: publicId,
    object: "model",
    created: upstream.created || 0,
    owned_by: name,
    name: upstream.name || upstreamId,
    upstreamModel: upstreamId,
  };
}

export async function createOpenAICompatibleAdapter(name, adapterConfig) {
  const configured = (adapterConfig.models || []).map((model) => normalizeConfiguredModel(name, model));
  const discovered = await discoverModels(name, adapterConfig);
  const models = mergeModels(configured, discovered);
  const byId = new Map(models.map((model) => [model.id, model]));
  const modelPrefixes = adapterConfig.modelPrefixes || [`${name}/`];

  function stripKnownPrefix(modelId) {
    const prefix = modelPrefixes.find((prefix) => modelId.startsWith(prefix));
    return prefix ? modelId.slice(prefix.length) : modelId.replace(`${name}/`, "");
  }

  return {
    name,
    models,
    canHandle(modelId) {
      return byId.has(modelId) || modelPrefixes.some((prefix) => modelId.startsWith(prefix));
    },
    async proxy(pathname, requestBody) {
      const modelId = requestBody.model || requestBody.model_id;
      const model = byId.get(modelId);
      const upstreamModel = model?.upstreamModel || stripKnownPrefix(modelId);
      const baseUrl = String(adapterConfig.baseUrl || "").replace(/\/+$/, "");
      if (!baseUrl) throw new Error(`Adapter ${name} has no baseUrl`);

      const apiKey = resolveSecret(adapterConfig.apiKey, adapterConfig.apiKeyEnv);
      const outboundHeaders = {
        "content-type": "application/json",
        ...adapterConfig.headers,
      };
      if (apiKey) outboundHeaders.authorization = `Bearer ${apiKey}`;

      const upstreamBody = {
        ...requestBody,
        ...(model?.requestOverrides || {}),
      };
      if (requestBody.model) upstreamBody.model = upstreamModel;
      if (requestBody.model_id) upstreamBody.model_id = upstreamModel;

      return fetch(`${baseUrl}${pathname.replace(/^\/v1/, "")}`, {
        method: "POST",
        headers: outboundHeaders,
        body: JSON.stringify(upstreamBody),
      });
    },
  };
}

async function discoverModels(name, adapterConfig) {
  if (!adapterConfig.discoverModels) return [];

  const baseUrl = String(adapterConfig.baseUrl || "").replace(/\/+$/, "");
  if (!baseUrl) return [];

  const prefix = adapterConfig.discoverPrefix || name;
  const apiKey = resolveSecret(adapterConfig.apiKey, adapterConfig.apiKeyEnv);
  const headers = { ...adapterConfig.headers };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;

  try {
    const response = await fetch(`${baseUrl}/models`, { headers });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const payload = await response.json();
    const items = Array.isArray(payload.data) ? payload.data : Array.isArray(payload.models) ? payload.models : [];
    return items.map((item) => normalizeDiscoveredModel(name, prefix, item)).filter(Boolean);
  } catch (error) {
    console.warn(`[${name}] model discovery failed: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

function mergeModels(configured, discovered) {
  const byId = new Map();
  for (const model of discovered) byId.set(model.id, model);
  for (const model of configured) byId.set(model.id, model);
  return [...byId.values()];
}
