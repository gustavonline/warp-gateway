import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureConfig, updateGatewayKeyForEndpoint, readState, writeState } from '../core/config-store.js';
import { startBackground, killPid, waitHttp } from '../core/processes.js';
import { ensureNgrokInstalled, hasValidNgrokConfig, getPublicEndpoint } from '../core/ngrok.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.resolve(__dirname, '..', 'server.js');

export async function start({ rotate = false } = {}) {
  const { paths, config } = ensureConfig();
  const ngrok = await ensureNgrokInstalled();
  if (!(await hasValidNgrokConfig(ngrok))) throw new Error('ngrok authtoken/config missing. Run warp-gateway setup.');

  const state = readState();
  for (const [name, pid] of [['gateway', state.gatewayPid], ['ngrok', state.ngrokPid], ['ChatMock', state.chatmockPid]]) {
    if (pid) killPid(pid);
  }

  console.log('Starting Warp Gateway in background...');
  const chatmockPid = startBackground('chatmock', 'chatmock', ['serve'], { out: paths.chatmockOut, err: paths.chatmockErr });
  console.log(`Started ChatMock (PID ${chatmockPid})`);
  await waitHttp('http://127.0.0.1:8000/v1/models', 30000);

  const ngrokPid = startBackground('ngrok', ngrok, ['http', String(config.port || 8320)], { out: paths.ngrokOut, err: paths.ngrokErr });
  console.log(`Started ngrok (PID ${ngrokPid})`);
  const endpoint = await getPublicEndpoint();
  const keyInfo = updateGatewayKeyForEndpoint(endpoint, { rotate });

  const gatewayPid = startBackground('gateway', process.execPath, [SERVER], {
    out: paths.gatewayLog,
    err: paths.gatewayLog,
    env: { WARP_GATEWAY_CONFIG: paths.config }
  });
  writeState({ ...keyInfo.state, chatmockPid, ngrokPid, gatewayPid });

  const needsWarpUpdate = ['endpoint-changed', 'missing-key', 'first-run', 'manual-rotation'].includes(keyInfo.reason);
  console.log('\nWarp Gateway started in background.');
  console.log(needsWarpUpdate ? '⚠️  Update Warp with these values:' : '✅ Endpoint unchanged. Warp settings should still work.');
  if (keyInfo.previousEndpoint && keyInfo.previousEndpoint !== endpoint) console.log(`Previous URL: ${keyInfo.previousEndpoint}`);
  console.log(`Endpoint URL: ${endpoint}`);
  console.log(`API key:      ${keyInfo.apiKey}`);
  console.log('Model:        gpt-5.5');
  console.log(`Reason:       ${keyInfo.reason}`);
  console.log(`Logs:         ${paths.gatewayLog}`);
}
