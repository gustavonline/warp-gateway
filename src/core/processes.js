import fs from 'node:fs';
import { spawn } from 'node:child_process';

export function commandExists(command) {
  const checker = process.platform === 'win32' ? 'where' : 'command';
  const args = process.platform === 'win32' ? [command] : ['-v', command];
  return new Promise((resolve) => {
    const p = spawn(checker, args, { stdio: 'ignore', shell: process.platform !== 'win32' });
    p.on('exit', (code) => resolve(code === 0));
  });
}

export function run(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(command, args, { stdio: options.stdio || 'inherit', shell: options.shell || false, env: { ...process.env, ...options.env } });
    p.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} exited ${code}`)));
    p.on('error', reject);
  });
}

export function startBackground(name, command, args, { out, err, cwd, env } = {}) {
  const outFd = fs.openSync(out, 'a');
  const errFd = fs.openSync(err, 'a');
  const p = spawn(command, args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', outFd, errFd], detached: true, shell: false, windowsHide: true });
  p.unref();
  return p.pid;
}

export function killPid(pid) {
  if (!pid) return;
  try { process.kill(Number(pid), process.platform === 'win32' ? undefined : 'SIGTERM'); } catch {}
}

export function isPidRunning(pid) {
  try { process.kill(Number(pid), 0); return true; } catch { return false; }
}

export async function waitHttp(url, ms = 30000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (r.ok) return r;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}
