import fs from 'node:fs';
import crypto from 'node:crypto';
import { ensureAppDirs } from './app-dirs.js';

export const DEFAULT_CONFIG = {
  host: '127.0.0.1',
  port: 8320,
  gatewayApiKeys: [],
  adapters: {
    chatmock: {
      enabled: true,
      baseUrl: 'http://127.0.0.1:8000/v1',
      apiKey: 'anything',
      models: [
        { id: 'gpt-5.5', name: 'ChatMock GPT-5.5' },
        { id: 'gpt-5.5-minimal', upstreamModel: 'gpt-5.5', name: 'GPT-5.5 Minimal Thinking', requestOverrides: { reasoning_effort: 'minimal' } },
        { id: 'gpt-5.5-low', upstreamModel: 'gpt-5.5', name: 'GPT-5.5 Low Thinking', requestOverrides: { reasoning_effort: 'low' } },
        { id: 'gpt-5.5-medium', upstreamModel: 'gpt-5.5', name: 'GPT-5.5 Medium Thinking', requestOverrides: { reasoning_effort: 'medium' } },
        { id: 'gpt-5.5-high', upstreamModel: 'gpt-5.5', name: 'GPT-5.5 High Thinking', requestOverrides: { reasoning_effort: 'high' } },
        { id: 'gpt-5.5-xhigh', upstreamModel: 'gpt-5.5', name: 'GPT-5.5 Extra High Thinking', requestOverrides: { reasoning_effort: 'xhigh' } }
      ]
    },
    lmstudio: {
      enabled: false,
      baseUrl: 'http://127.0.0.1:1234/v1',
      apiKey: 'lm-studio',
      discoverModels: true,
      discoverPrefix: 'lmstudio',
      models: []
    },
    lemonade: {
      enabled: false,
      baseUrl: 'http://127.0.0.1:13305/v1',
      apiKey: 'lemonade',
      discoverModels: true,
      discoverPrefix: 'lemonade',
      models: []
    }
  }
};

export function randomKey() {
  return crypto.randomBytes(24).toString('hex');
}

export function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

export function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

export function ensureConfig() {
  const paths = ensureAppDirs();
  if (!fs.existsSync(paths.config)) writeJson(paths.config, DEFAULT_CONFIG);
  const config = readJson(paths.config, DEFAULT_CONFIG);
  config.gatewayApiKeys ??= [];
  config.adapters ??= DEFAULT_CONFIG.adapters;
  return { paths, config };
}

export function readState() {
  const paths = ensureAppDirs();
  return readJson(paths.state, {});
}

export function writeState(state) {
  const paths = ensureAppDirs();
  writeJson(paths.state, state);
}

export function updateGatewayKeyForEndpoint(endpoint, { rotate = false } = {}) {
  const { paths, config } = ensureConfig();
  const state = readState();
  const previousEndpoint = state.endpointUrl || '';
  let reason = 'unchanged';

  if (!config.gatewayApiKeys?.[0]) {
    config.gatewayApiKeys = [randomKey()];
    reason = 'missing-key';
  } else if (rotate || (previousEndpoint && previousEndpoint !== endpoint)) {
    config.gatewayApiKeys = [randomKey()];
    reason = rotate ? 'manual-rotation' : 'endpoint-changed';
  } else if (!previousEndpoint) {
    reason = 'first-run';
  }

  state.endpointUrl = endpoint;
  state.updatedAt = new Date().toISOString();
  state.gatewayKeyReason = reason;
  writeJson(paths.config, config);
  writeState(state);
  return { paths, config, state, apiKey: config.gatewayApiKeys[0], reason, previousEndpoint };
}
