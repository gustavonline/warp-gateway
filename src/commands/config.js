import { ensureConfig, readState, writeJson } from '../core/config-store.js';
import { isPidRunning } from '../core/processes.js';
import { start } from './start.js';
import { stop } from './stop.js';

const PROVIDER_PRESETS = {
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
};

function printHelp() {
  console.log(`Warp Gateway config

Most common:
  warp-gateway config providers              List providers and whether they are enabled
  warp-gateway config enable lmstudio        Enable LM Studio provider
  warp-gateway config disable lmstudio       Disable LM Studio provider
  warp-gateway config enable lemonade        Enable Lemonade provider

When gateway is already running, config changes restart it automatically.
If it is stopped, run warp-gateway start afterwards.

Other commands:
  warp-gateway config show                   Print full config JSON
  warp-gateway config path                   Print config file path
  warp-gateway config get <key>              Read one value, e.g. port
  warp-gateway config set <key> <value>      Set one value

Useful examples:
  warp-gateway config set port 8320
  warp-gateway config set adapters.lmstudio.baseUrl http://127.0.0.1:1234/v1
  warp-gateway config set adapters.lemonade.baseUrl http://127.0.0.1:13305/v1

Known providers:
  chatmock   ChatMock/Codex, default provider, uses gpt-5.5 aliases
  lmstudio   Local LM Studio OpenAI-compatible server, models show as lmstudio/<model>
  lemonade   Local Lemonade OpenAI-compatible server, models show as lemonade/<model>`);
}

function parseValue(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  try { return JSON.parse(value); } catch { return value; }
}

function getPath(object, dotted) {
  return dotted.split('.').filter(Boolean).reduce((cur, part) => cur?.[part], object);
}

function setPath(object, dotted, value) {
  const parts = dotted.split('.').filter(Boolean);
  if (parts.length === 0) throw new Error('Missing config key');
  let cur = object;
  for (const part of parts.slice(0, -1)) {
    if (!cur[part] || typeof cur[part] !== 'object') cur[part] = {};
    cur = cur[part];
  }
  cur[parts.at(-1)] = value;
}

function ensureProvider(config, name) {
  config.adapters ??= {};
  if (!config.adapters[name]) config.adapters[name] = structuredClone(PROVIDER_PRESETS[name] || { baseUrl: '', apiKey: '', models: [] });
  return config.adapters[name];
}

async function restartIfRunning() {
  const state = readState();
  const running = state.gatewayPid && isPidRunning(state.gatewayPid);
  if (!running) {
    console.log('Start to apply: warp-gateway start');
    return;
  }
  console.log('Gateway is running. Restarting automatically to apply changes...');
  await stop();
  await start();
}

function providerSummary(config) {
  console.log('Providers');
  console.log('');
  for (const [name, provider] of Object.entries(config.adapters || {})) {
    const models = provider.discoverModels ? `auto-discovery as ${provider.discoverPrefix || name}/<model>` : `${provider.models?.length || 0} configured model(s)`;
    console.log(`${provider.enabled ? '✅ enabled ' : '❌ disabled'} ${name}`);
    console.log(`   URL:    ${provider.baseUrl || '(not set)'}`);
    console.log(`   Models: ${models}`);
    if (name === 'lmstudio' && !provider.enabled) console.log('   Enable: warp-gateway config enable lmstudio');
    if (name === 'lemonade' && !provider.enabled) console.log('   Enable: warp-gateway config enable lemonade');
  }
  console.log('');
  console.log('Config changes auto-restart the gateway when it is running.');
}

export async function configCommand(args = []) {
  const { paths, config } = ensureConfig();
  const [sub = 'help', ...rest] = args;

  if (sub === 'help' || sub === '--help' || sub === '-h') return printHelp();
  if (sub === 'path') return console.log(paths.config);
  if (sub === 'show') {
    console.log(`Config: ${paths.config}`);
    console.log(JSON.stringify(config, null, 2));
    return;
  }
  if (sub === 'providers' || sub === 'provider' || sub === 'list') {
    console.log(`Config: ${paths.config}\n`);
    providerSummary(config);
    return;
  }
  if (sub === 'enable' || sub === 'disable') {
    const providerName = rest[0];
    if (!providerName) throw new Error(`Usage: warp-gateway config ${sub} <provider>\nTry: warp-gateway config providers`);
    const provider = ensureProvider(config, providerName);
    provider.enabled = sub === 'enable';
    writeJson(paths.config, config);
    console.log(`${sub === 'enable' ? 'Enabled' : 'Disabled'} provider: ${providerName}`);
    if (provider.baseUrl) console.log(`URL: ${provider.baseUrl}`);
    await restartIfRunning();
    return;
  }
  if (sub === 'get') {
    const key = rest[0];
    if (!key) throw new Error('Usage: warp-gateway config get <key>');
    const value = getPath(config, key);
    console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2));
    return;
  }
  if (sub === 'set') {
    const [key, ...valueParts] = rest;
    if (!key || valueParts.length === 0) throw new Error('Usage: warp-gateway config set <key> <value>');
    setPath(config, key, parseValue(valueParts.join(' ')));
    writeJson(paths.config, config);
    console.log(`Set ${key}`);
    await restartIfRunning();
    return;
  }

  throw new Error(`Unknown config command: ${sub}\nTry: warp-gateway config help`);
}
