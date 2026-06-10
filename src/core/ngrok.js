import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { commandExists, run, waitHttp } from './processes.js';
import { getPaths } from './app-dirs.js';
import { dim, ok } from './ui.js';

export async function findNgrok() {
  const paths = getPaths();
  const executable = process.platform === 'win32' ? 'ngrok.exe' : 'ngrok';
  const candidates = [
    path.join(paths.toolsDir, 'ngrok', executable),
    path.join(paths.root, 'tools', 'ngrok', executable)
  ];
  for (const local of candidates) {
    if (fs.existsSync(local)) return local;
  }
  if (await commandExists('ngrok')) return 'ngrok';
  return '';
}

export async function getNgrokVersion(ngrok) {
  return new Promise((resolve) => {
    const p = spawn(ngrok, ['version'], { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    p.stdout.on('data', (buf) => { out += buf; });
    p.on('exit', () => {
      const match = out.match(/ngrok version\s+(\d+)\.(\d+)\.(\d+)/i);
      resolve(match ? { raw: match[0], major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) } : undefined);
    });
    p.on('error', () => resolve(undefined));
  });
}

export function isSupportedNgrokVersion(version) {
  if (!version) return false;
  if (version.major > 3) return true;
  if (version.major < 3) return false;
  return version.minor >= 20;
}

function ngrokDownloadSpec() {
  const arch = process.arch === 'arm64' ? 'arm64' : process.arch === 'x64' ? 'amd64' : '';
  if (!arch) return undefined;
  if (process.platform === 'win32') return { platform: 'windows', arch, executable: 'ngrok.exe' };
  if (process.platform === 'darwin') return { platform: 'darwin', arch, executable: 'ngrok' };
  if (process.platform === 'linux') return { platform: 'linux', arch, executable: 'ngrok' };
  return undefined;
}

async function downloadNgrok() {
  const spec = ngrokDownloadSpec();
  if (!spec) throw new Error(`Automatic ngrok install is not supported on ${process.platform}/${process.arch}`);

  const paths = getPaths();
  const dir = path.join(paths.toolsDir, 'ngrok');
  fs.mkdirSync(dir, { recursive: true });
  const zip = path.join(dir, 'ngrok.zip');
  const exe = path.join(dir, spec.executable);
  const url = `https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-${spec.platform}-${spec.arch}.zip`;
  console.log(dim(`Downloading current ngrok for ${spec.platform}/${spec.arch}...`));
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed downloading ngrok: ${response.status}`);
  fs.writeFileSync(zip, Buffer.from(await response.arrayBuffer()));
  if (process.platform === 'win32') {
    await run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', `Expand-Archive -Force '${zip}' '${dir}'`]);
  } else {
    await run('unzip', ['-o', zip, '-d', dir]);
    fs.chmodSync(exe, 0o755);
  }
  ok(`ngrok ready: ${exe}`);
  return exe;
}

export async function ensureNgrokInstalled() {
  const existing = await findNgrok();
  if (existing && isSupportedNgrokVersion(await getNgrokVersion(existing))) return existing;
  if (existing) {
    console.log('ngrok is installed but too old; attempting ngrok update...');
    try {
      await run(existing, ['update']);
      if (isSupportedNgrokVersion(await getNgrokVersion(existing))) return existing;
    } catch {}
  }
  try {
    const downloaded = await downloadNgrok();
    if (isSupportedNgrokVersion(await getNgrokVersion(downloaded))) return downloaded;
  } catch (error) {
    throw new Error(`ngrok not found or too old, and automatic install failed: ${error.message}. Install/update ngrok manually: https://ngrok.com/download`);
  }
  throw new Error('Downloaded ngrok is not a supported version. Install/update ngrok manually: https://ngrok.com/download');
}

export async function hasValidNgrokConfig(ngrok) {
  return new Promise((resolve) => {
    const p = spawn(ngrok, ['config', 'check'], { stdio: 'ignore' });
    p.on('exit', (code) => resolve(code === 0));
    p.on('error', () => resolve(false));
  });
}

export async function addAuthtoken(ngrok, token) {
  await run(ngrok, ['config', 'add-authtoken', token]);
}

function redactSecrets(text) {
  return text
    .replace(/(Your authtoken:\s*)\S+/gi, '$1[redacted]')
    .replace(/(authtoken\s+)[A-Za-z0-9_-]{20,}/gi, '$1[redacted]');
}

function tailFile(file, lines = 20) {
  try {
    return redactSecrets(fs.readFileSync(file, 'utf8').split('\n').slice(-lines).join('\n').trim());
  } catch {
    return '';
  }
}

function ngrokTroubleshooting(logFile) {
  const tail = logFile ? tailFile(logFile) : '';
  if (!tail) return '';
  const lines = ['Last ngrok log lines:', tail];
  if (/ERR_NGROK_107|authentication failed|authtoken/i.test(tail)) {
    lines.push('', 'Your ngrok authtoken looks invalid or revoked. Run: warp-gateway setup --reset-ngrok-token');
    lines.push('Token page: https://dashboard.ngrok.com/get-started/your-authtoken');
  }
  if (/addr already in use|bind/i.test(tail)) {
    lines.push('', 'Another ngrok process may already be using port 4040. Run: warp-gateway stop');
  }
  return lines.join('\n');
}

export async function getPublicEndpoint({ logFile, timeoutMs = 25000 } = {}) {
  try {
    await waitHttp('http://127.0.0.1:4040/api/tunnels', timeoutMs);
  } catch (error) {
    const detail = ngrokTroubleshooting(logFile);
    throw new Error(`ngrok did not start its local API on http://127.0.0.1:4040.\n${detail || error.message}`);
  }
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch('http://127.0.0.1:4040/api/tunnels', { signal: AbortSignal.timeout(2000) });
      const j = await r.json();
      const tunnel = (j.tunnels || []).find((t) => t.proto === 'https');
      if (tunnel?.public_url) return `${tunnel.public_url}/v1`;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  const detail = ngrokTroubleshooting(logFile);
  throw new Error(`ngrok tunnel did not expose a public HTTPS endpoint.\n${detail || 'Check the ngrok dashboard and logs.'}`);
}
