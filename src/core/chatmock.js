import fs from 'node:fs';
import path from 'node:path';
import { commandExists, run } from './processes.js';
import { getPaths } from './app-dirs.js';

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

export async function ensureChatMockInstalled() {
  const py = await findPython();
  if (!py) throw new Error('Python was not found. Install Python 3 first.');

  const dir = venvDir();
  const local = localChatMockCommand();
  const python = venvPython();

  fs.mkdirSync(path.dirname(dir), { recursive: true });
  if (!fs.existsSync(python)) {
    console.log(`Creating ChatMock virtual environment: ${dir}`);
    await run(py, ['-m', 'venv', dir]);
  }

  await run(python, ['-m', 'pip', 'install', '--upgrade', 'pip', 'chatmock']);
  if (!fs.existsSync(local)) throw new Error(`ChatMock installed, but command was not found at ${local}`);
  return local;
}
