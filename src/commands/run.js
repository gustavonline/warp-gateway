import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ensureConfig, updateGatewayKeyForEndpoint, readState, writeState } from '../core/config-store.js';
import { startBackground, killPid, waitHttp } from '../core/processes.js';
import { ensureNgrokInstalled, hasValidNgrokConfig, getPublicEndpoint } from '../core/ngrok.js';
import { findChatMock } from '../core/chatmock.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.resolve(__dirname, '..', 'server.js');

function copy(text) {
  try {
    const cmd = process.platform === 'win32' ? 'clip' : process.platform === 'darwin' ? 'pbcopy' : 'xclip';
    const p = spawn(cmd, [], { stdio: ['pipe', 'ignore', 'ignore'] });
    p.on('error', () => {});
    p.stdin.end(text);
  } catch {}
}

export async function runCommand({ rotate = false } = {}) {
  const { paths, config } = ensureConfig();
  const ngrok = await ensureNgrokInstalled();
  const chatmock = await findChatMock();
  if (!chatmock) throw new Error('ChatMock was not found. Run warp-gateway setup.');
  if (!(await hasValidNgrokConfig(ngrok))) throw new Error('ngrok authtoken/config missing. Run warp-gateway setup.');

  console.log('Starting ChatMock and ngrok in background, gateway logs in this terminal...');
  const state = readState();
  if (state.chatmockPid) killPid(state.chatmockPid);
  if (state.ngrokPid) killPid(state.ngrokPid);

  const chatmockPid = startBackground('chatmock', chatmock, ['serve'], { out: paths.chatmockOut, err: paths.chatmockErr });
  console.log(`Started ChatMock (PID ${chatmockPid})`);
  console.log('Waiting for ChatMock on http://127.0.0.1:8000/v1/models...');
  await waitHttp('http://127.0.0.1:8000/v1/models', 30000);

  const ngrokPid = startBackground('ngrok', ngrok, ['http', String(config.port || 8320)], { out: paths.ngrokOut, err: paths.ngrokErr });
  console.log(`Started ngrok (PID ${ngrokPid})`);
  const endpoint = await getPublicEndpoint();
  const keyInfo = updateGatewayKeyForEndpoint(endpoint, { rotate });
  writeState({ ...keyInfo.state, chatmockPid, ngrokPid });

  const needsWarpUpdate = ['endpoint-changed', 'missing-key', 'first-run', 'manual-rotation'].includes(keyInfo.reason);
  copy(endpoint);

  console.log('\nWarp setup instructions');
  if (needsWarpUpdate) console.log('⚠️  Update Warp with these values:');
  else console.log('✅ Endpoint unchanged. Warp settings should still work.');
  if (keyInfo.previousEndpoint && keyInfo.previousEndpoint !== endpoint) console.log(`Previous URL: ${keyInfo.previousEndpoint}`);
  console.log(`Endpoint URL: ${endpoint}`);
  console.log(`API key:      ${keyInfo.apiKey}`);
  console.log('Model:        gpt-5.5');
  console.log('\nThinking aliases: gpt-5.5-minimal, gpt-5.5-low, gpt-5.5-medium, gpt-5.5-high, gpt-5.5-xhigh');
  console.log(`Reason:       ${keyInfo.reason}`);
  console.log('Endpoint URL copied to clipboard when supported.');

  console.log('\nGateway logs below. Keep this terminal open. Ctrl+C stops everything.');
  const logFd = fs.openSync(paths.gatewayLog, 'a');
  const server = spawn(process.execPath, [SERVER], {
    stdio: ['inherit', 'pipe', 'pipe'],
    env: { ...process.env, WARP_GATEWAY_CONFIG: paths.config }
  });
  const writeLog = (buf) => { process.stdout.write(buf); fs.writeSync(logFd, buf); };
  server.stdout.on('data', writeLog);
  server.stderr.on('data', writeLog);

  const cleanup = () => {
    killPid(ngrokPid);
    killPid(chatmockPid);
    fs.closeSync(logFd);
  };
  process.once('SIGINT', () => { cleanup(); process.exit(0); });
  process.once('SIGTERM', () => { cleanup(); process.exit(0); });
  server.on('exit', (code) => { cleanup(); process.exit(code || 0); });
}
