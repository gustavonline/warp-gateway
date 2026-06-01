import { resolveSecret } from "../config.js";

export function createOpenAICompatibleAdapter(name, adapterConfig) {
  const models = (adapterConfig.models || []).map((model) => ({
    id: model.id,
    object: "model",
    created: 0,
    owned_by: name,
    name: model.name || model.id,
    upstreamModel: model.upstreamModel || model.id.replace(`${name}/`, ""),
  }));

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
    async proxy(pathname, requestBody, headers = {}) {
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

      const upstreamBody = { ...requestBody };
      if (requestBody.model) upstreamBody.model = upstreamModel;
      if (requestBody.model_id) upstreamBody.model_id = upstreamModel;

      const response = await fetch(`${baseUrl}${pathname.replace(/^\/v1/, "")}`, {
        method: "POST",
        headers: outboundHeaders,
        body: JSON.stringify(upstreamBody),
      });

      return response;
    },
  };
}
