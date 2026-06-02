import { spawn } from 'node:child_process';

const PACKAGE_NAME = '@gustavonline/warp-gateway';
const CURRENT_VERSION = '0.3.2';

function parseVersion(version) {
  return String(version || '').split('.').map((part) => Number(part.replace(/\D.*/, '')) || 0);
}

function compareVersions(a, b) {
  const av = parseVersion(a);
  const bv = parseVersion(b);
  for (let i = 0; i < Math.max(av.length, bv.length); i += 1) {
    const diff = (av[i] || 0) - (bv[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function execOutput(command, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' });
    let out = '';
    let err = '';
    p.stdout.on('data', (buf) => { out += buf; });
    p.stderr.on('data', (buf) => { err += buf; });
    p.on('exit', (code) => code === 0 ? resolve(out.trim()) : reject(new Error(err.trim() || `${command} exited ${code}`)));
    p.on('error', reject);
  });
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
    p.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)));
    p.on('error', reject);
  });
}

export async function getLatestVersion() {
  return execOutput('npm', ['view', PACKAGE_NAME, 'version', '--registry=https://registry.npmjs.org/']);
}

export async function update({ checkOnly = false } = {}) {
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
    console.log('Warp Gateway is up to date.');
    return;
  }

  console.log(`Update available: ${CURRENT_VERSION} -> ${latest}`);
  if (checkOnly) {
    console.log(`Run: npm install -g ${PACKAGE_NAME}`);
    return;
  }

  console.log('Updating global npm package...');
  await run('npm', ['install', '-g', PACKAGE_NAME]);
  console.log('Update complete. Restart the gateway if it is running:');
  console.log('  warp-gateway stop');
  console.log('  warp-gateway start');
}

export { CURRENT_VERSION, PACKAGE_NAME };
