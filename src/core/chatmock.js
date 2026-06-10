import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { commandExists, run } from './processes.js';
import { getPaths } from './app-dirs.js';
import { dim, ok } from './ui.js';

export async function findPython() {
  if (await commandExists('python3')) return 'python3';
  if (await commandExists('python')) return 'python';
  return '';
}

function venvDir() {
  return path.join(getPaths().toolsDir, 'chatmock-venv');
}

function venvPython() {
  const dir = venvDir();
  return process.platform === 'win32'
    ? path.join(dir, 'Scripts', 'python.exe')
    : path.join(dir, 'bin', 'python');
}

export function localChatMockCommand() {
  const dir = venvDir();
  return process.platform === 'win32'
    ? path.join(dir, 'Scripts', 'chatmock.exe')
    : path.join(dir, 'bin', 'chatmock');
}

export async function findChatMock() {
  const local = localChatMockCommand();
  if (fs.existsSync(local)) return local;
  if (await commandExists('chatmock')) return 'chatmock';
  return '';
}

function runQuiet(command, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    p.stdout.on('data', (buf) => { out += buf; });
    p.stderr.on('data', (buf) => { err += buf; });
    p.on('exit', (code) => {
      if (code === 0) return resolve({ out, err });
      const combined = `${out}\n${err}`.trim();
      reject(new Error(combined || `${command} ${args.join(' ')} exited ${code}`));
    });
    p.on('error', reject);
  });
}

export async function ensureChatMockInstalled() {
  const py = await findPython();
  if (!py) throw new Error('Python was not found. Install Python 3 first.');

  const dir = venvDir();
  const local = localChatMockCommand();
  const python = venvPython();

  fs.mkdirSync(path.dirname(dir), { recursive: true });
  if (!fs.existsSync(python)) {
    console.log(dim(`Creating local ChatMock environment: ${dir}`));
    await run(py, ['-m', 'venv', dir]);
  }

  console.log(dim('Installing/updating ChatMock quietly (this can take a minute on first run)...'));
  try {
    await runQuiet(python, ['-m', 'pip', 'install', '--upgrade', '--disable-pip-version-check', '--quiet', 'pip', 'chatmock']);
  } catch (error) {
    console.log('\nChatMock install failed. pip output:');
    throw error;
  }
  if (!fs.existsSync(local)) throw new Error(`ChatMock installed, but command was not found at ${local}`);
  ok(`ChatMock ready: ${local}`);
  return local;
}
