import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

export function getAppDir() {
  if (process.env.WARP_GATEWAY_HOME) return path.resolve(process.env.WARP_GATEWAY_HOME);
  if (process.platform === 'win32') return path.join(process.env.APPDATA || os.homedir(), 'warp-gateway');
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'warp-gateway');
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'warp-gateway');
}

function getToolsDir(root) {
  if (process.env.WARP_GATEWAY_TOOLS_DIR) return path.resolve(process.env.WARP_GATEWAY_TOOLS_DIR);
  // macOS "Application Support" contains a space. Python console-script shebangs and
  // some downloaded tools are more reliable from a no-space executable path.
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Caches', 'warp-gateway', 'tools');
  return path.join(root, 'tools');
}

export function getPaths() {
  const root = getAppDir();
  const toolsDir = getToolsDir(root);
  return {
    root,
    config: path.join(root, 'config.json'),
    state: path.join(root, 'state.json'),
    runDir: path.join(root, 'run'),
    logDir: path.join(root, 'logs'),
    toolsDir,
    gatewayLog: path.join(root, 'logs', 'gateway.log'),
    chatmockOut: path.join(root, 'logs', 'chatmock.out.log'),
    chatmockErr: path.join(root, 'logs', 'chatmock.err.log'),
    ngrokOut: path.join(root, 'logs', 'ngrok.out.log'),
    ngrokErr: path.join(root, 'logs', 'ngrok.err.log'),
  };
}

export function ensureAppDirs() {
  const p = getPaths();
  for (const dir of [p.root, p.runDir, p.logDir, p.toolsDir]) fs.mkdirSync(dir, { recursive: true });
  return p;
}
