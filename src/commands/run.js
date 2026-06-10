import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ensureConfig, updateGatewayKeyForEndpoint, readState, writeState } from '../core/config-store.js';
import { startBackground, killPid, waitHttp } from '../core/processes.js';
import { ensureNgrokInstalled, hasValidNgrokConfig, getPublicEndpoint } from '../core/ngrok.js';
import { findChatMock } from '../core/chatmock.js';
import { command, header, info, ok, step, warn } from '../core/ui.js';

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

  header('Starting Warp Gateway', 'ChatMock + ngrok + local OpenAI-compatible gateway');
  const state = readState();
  if (state.chatmockPid) killPid(state.chatmockPid);
  if (state.ngrokPid) killPid(state.ngrokPid);

  let chatmockPid;
  let ngrokPid;
  let endpoint;
  let keyInfo;
  try {
    step(1, 3, 'Starting ChatMock');
    chatmockPid = startBackground('chatmock', chatmock, ['serve'], { out: paths.chatmockOut, err: paths.chatmockErr });
    ok(`ChatMock started (PID ${chatmockPid})`);
    info('Waiting for ChatMock on http://127.0.0.1:8000/v1/models');
    await waitHttp('http://127.0.0.1:8000/v1/models', 30000);

    step(2, 3, 'Starting ngrok');
    ngrokPid = startBackground('ngrok', ngrok, ['http', String(config.port || 8320)], { out: paths.ngrokOut, err: paths.ngrokErr });
    ok(`ngrok started (PID ${ngrokPid})`);
    endpoint = await getPublicEndpoint({ logFile: paths.ngrokErr });

    step(3, 3, 'Starting gateway');
    keyInfo = updateGatewayKeyForEndpoint(endpoint, { rotate });
    writeState({ ...keyInfo.state, chatmockPid, ngrokPid });
  } catch (error) {
    killPid(ngrokPid);
    killPid(chatmockPid);
    writeState({ ...readState(), ngrokPid: undefined, chatmockPid: undefined });
    throw error;
  }

  const needsWarpUpdate = ['endpoint-changed', 'missing-key', 'first-run', 'manual-rotation'].includes(keyInfo.reason);
  copy(endpoint);

  console.log('\nWarp setup instructions');
  if (needsWarpUpdate) warn('Update Warp with these values:');
  else ok('Endpoint unchanged. Warp settings should still work.');
  if (keyInfo.previousEndpoint && keyInfo.previousEndpoint !== endpoint) console.log(`Previous URL: ${keyInfo.previousEndpoint}`);
  console.log(`Endpoint URL: ${command(endpoint)}`);
  console.log(`API key:      ${command(keyInfo.apiKey)}`);
  console.log(`Model:        ${command('gpt-5.5')}`);
  console.log('\nThinking aliases: gpt-5.5-minimal, gpt-5.5-low, gpt-5.5-medium, gpt-5.5-high, gpt-5.5-xhigh');
  console.log(`Reason:       ${keyInfo.reason}`);
  info('Endpoint URL copied to clipboard when supported.');

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
