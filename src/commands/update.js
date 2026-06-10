import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readState, writeState } from '../core/config-store.js';
import { command, header, ok, warn } from '../core/ui.js';

const PACKAGE_NAME = '@gustavonline/warp-gateway';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readCurrentVersion() {
  try {
    const packageJson = path.resolve(__dirname, '..', '..', 'package.json');
    return JSON.parse(fs.readFileSync(packageJson, 'utf8')).version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const CURRENT_VERSION = readCurrentVersion();
const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

function parseVersion(version) {
  return String(version || '').split('.').map((part) => Number(part.replace(/\D.*/, '')) || 0);
}

export function compareVersions(a, b) {
  const av = parseVersion(a);
  const bv = parseVersion(b);
  for (let i = 0; i < Math.max(av.length, bv.length); i += 1) {
    const diff = (av[i] || 0) - (bv[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function execOutput(command, args, { timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' });
    let out = '';
    let err = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { p.kill(); } catch {}
      reject(new Error(`${command} timed out`));
    }, timeout);
    p.stdout.on('data', (buf) => { out += buf; });
    p.stderr.on('data', (buf) => { err += buf; });
    p.on('exit', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      code === 0 ? resolve(out.trim()) : reject(new Error(err.trim() || `${command} exited ${code}`));
    });
    p.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
  });
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
    p.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)));
    p.on('error', reject);
  });
}

export async function getLatestVersion(options = {}) {
  return execOutput('npm', ['view', PACKAGE_NAME, 'version', '--registry=https://registry.npmjs.org/'], options);
}

export async function notifyIfUpdateAvailable({ force = false } = {}) {
  if (process.env.WARP_GATEWAY_NO_UPDATE_CHECK) return;

  const state = readState();
  const now = Date.now();
  const last = Date.parse(state.lastUpdateCheckAt || '');
  if (!force && Number.isFinite(last) && now - last < UPDATE_CHECK_INTERVAL_MS) return;

  writeState({ ...state, lastUpdateCheckAt: new Date(now).toISOString() });

  let latest;
  try {
    latest = await getLatestVersion({ timeout: 3000 });
  } catch {
    return;
  }

  if (compareVersions(latest, CURRENT_VERSION) <= 0) return;

  writeState({ ...readState(), latestVersion: latest });
  console.error(`\n⬆️  Update available for Warp Gateway: ${CURRENT_VERSION} -> ${latest}`);
  console.error(`Run: ${command('warp-gateway update')}\n`);
}

export async function update({ checkOnly = false } = {}) {
  header('Warp Gateway update');
  console.log(`Current version: ${CURRENT_VERSION}`);
  let latest;
  try {
    latest = await getLatestVersion();
  } catch (error) {
    console.log(`Could not check npm for updates: ${error.message}`);
    return;
  }
  console.log(`Latest version:  ${latest}`);

  if (compareVersions(latest, CURRENT_VERSION) <= 0) {
    ok('Warp Gateway is up to date.');
    return;
  }

  warn(`Update available: ${CURRENT_VERSION} -> ${latest}`);
  if (checkOnly) {
    console.log(`Run: ${command(`npm install -g ${PACKAGE_NAME}`)}`);
    return;
  }

  console.log('Updating global npm package...');
  await run('npm', ['install', '-g', PACKAGE_NAME]);
  ok('Update complete. Restart the gateway if it is running:');
  console.log('  warp-gateway stop');
  console.log('  warp-gateway start');
}

export { CURRENT_VERSION, PACKAGE_NAME };
