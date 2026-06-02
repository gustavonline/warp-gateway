import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { commandExists, run, waitHttp } from './processes.js';
import { getPaths } from './app-dirs.js';

export async function findNgrok() {
  const paths = getPaths();
  const local = process.platform === 'win32' ? path.join(paths.toolsDir, 'ngrok', 'ngrok.exe') : path.join(paths.toolsDir, 'ngrok', 'ngrok');
  if (fs.existsSync(local)) return local;
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

async function downloadWindowsNgrok() {
  const paths = getPaths();
  const dir = path.join(paths.toolsDir, 'ngrok');
  fs.mkdirSync(dir, { recursive: true });
  const zip = path.join(dir, 'ngrok.zip');
  const exe = path.join(dir, 'ngrok.exe');
  const url = 'https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip';
  console.log('Downloading current ngrok for Windows...');
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed downloading ngrok: ${response.status}`);
  fs.writeFileSync(zip, Buffer.from(await response.arrayBuffer()));
  await run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', `Expand-Archive -Force '${zip}' '${dir}'`]);
  return exe;
}

export async function ensureNgrokInstalled() {
  const existing = await findNgrok();
  if (existing && isSupportedNgrokVersion(await getNgrokVersion(existing))) return existing;
  if (process.platform === 'win32') return downloadWindowsNgrok();
  if (existing) {
    console.log('ngrok is installed but too old; attempting ngrok update...');
    try {
      await run(existing, ['update']);
      if (isSupportedNgrokVersion(await getNgrokVersion(existing))) return existing;
    } catch {}
  }
  throw new Error('ngrok not found or too old. Install/update ngrok first: https://ngrok.com/download');
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

export async function getPublicEndpoint() {
  await waitHttp('http://127.0.0.1:4040/api/tunnels', 25000);
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch('http://127.0.0.1:4040/api/tunnels', { signal: AbortSignal.timeout(2000) });
      const j = await r.json();
      const tunnel = (j.tunnels || []).find((t) => t.proto === 'https');
      if (tunnel?.public_url) return `${tunnel.public_url}/v1`;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('ngrok tunnel did not expose a public HTTPS endpoint');
}
