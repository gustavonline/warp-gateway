import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureConfig, updateGatewayKeyForEndpoint, readState, writeState } from '../core/config-store.js';
import { startBackground, killPid, waitHttp } from '../core/processes.js';
import { ensureNgrokInstalled, hasValidNgrokConfig, getPublicEndpoint } from '../core/ngrok.js';
import { findChatMock } from '../core/chatmock.js';
import { command, header, ok, step, warn } from '../core/ui.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.resolve(__dirname, '..', 'server.js');

export async function start({ rotate = false } = {}) {
  const { paths, config } = ensureConfig();
  const ngrok = await ensureNgrokInstalled();
  const chatmock = await findChatMock();
  if (!chatmock) throw new Error('ChatMock was not found. Run warp-gateway setup.');
  if (!(await hasValidNgrokConfig(ngrok))) throw new Error('ngrok authtoken/config missing. Run warp-gateway setup.');

  const state = readState();
  for (const [name, pid] of [['gateway', state.gatewayPid], ['ngrok', state.ngrokPid], ['ChatMock', state.chatmockPid]]) {
    if (pid) killPid(pid);
  }

  header('Starting Warp Gateway in background');
  let chatmockPid;
  let ngrokPid;
  let gatewayPid;
  let endpoint;
  let keyInfo;
  try {
    step(1, 3, 'Starting ChatMock');
    chatmockPid = startBackground('chatmock', chatmock, ['serve'], { out: paths.chatmockOut, err: paths.chatmockErr });
    ok(`ChatMock started (PID ${chatmockPid})`);
    await waitHttp('http://127.0.0.1:8000/v1/models', 30000);

    step(2, 3, 'Starting ngrok');
    ngrokPid = startBackground('ngrok', ngrok, ['http', String(config.port || 8320)], { out: paths.ngrokOut, err: paths.ngrokErr });
    ok(`ngrok started (PID ${ngrokPid})`);
    endpoint = await getPublicEndpoint({ logFile: paths.ngrokErr });

    step(3, 3, 'Starting gateway');
    keyInfo = updateGatewayKeyForEndpoint(endpoint, { rotate });

    gatewayPid = startBackground('gateway', process.execPath, [SERVER], {
      out: paths.gatewayLog,
      err: paths.gatewayLog,
      env: { WARP_GATEWAY_CONFIG: paths.config }
    });
    writeState({ ...keyInfo.state, chatmockPid, ngrokPid, gatewayPid });
  } catch (error) {
    killPid(gatewayPid);
    killPid(ngrokPid);
    killPid(chatmockPid);
    writeState({ ...readState(), gatewayPid: undefined, ngrokPid: undefined, chatmockPid: undefined });
    throw error;
  }

  const needsWarpUpdate = ['endpoint-changed', 'missing-key', 'first-run', 'manual-rotation'].includes(keyInfo.reason);
  console.log('\nWarp Gateway started in background.');
  if (needsWarpUpdate) warn('Update Warp with these values:');
  else ok('Endpoint unchanged. Warp settings should still work.');
  if (keyInfo.previousEndpoint && keyInfo.previousEndpoint !== endpoint) console.log(`Previous URL: ${keyInfo.previousEndpoint}`);
  console.log(`Endpoint URL: ${command(endpoint)}`);
  console.log(`API key:      ${command(keyInfo.apiKey)}`);
  console.log(`Model:        ${command('gpt-5.5')}`);
  console.log(`Reason:       ${keyInfo.reason}`);
  console.log(`Logs:         ${paths.gatewayLog}`);
}
