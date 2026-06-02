import fs from 'node:fs';
import { getPaths } from '../core/app-dirs.js';

function tail(file, n) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).slice(-n);
}

function resolveLog(file) {
  const p = getPaths();
  const map = { gateway: p.gatewayLog, chatmock: p.chatmockOut, 'chatmock-errors': p.chatmockErr, ngrok: p.ngrokOut, 'ngrok-errors': p.ngrokErr };
  return map[file] || map.gateway;
}

export async function logs({ lines = 50, file = 'gateway', follow = false } = {}) {
  const target = resolveLog(file);
  console.log(`Log file: ${target}`);
  for (const line of tail(target, Number(lines) || 50)) console.log(line);
  if (!follow) return;

  console.log('\nFollowing logs. Press Ctrl+C to stop.');
  let position = fs.existsSync(target) ? fs.statSync(target).size : 0;
  fs.watchFile(target, { interval: 500 }, () => {
    if (!fs.existsSync(target)) return;
    const size = fs.statSync(target).size;
    if (size < position) position = 0;
    if (size === position) return;
    const fd = fs.openSync(target, 'r');
    const buf = Buffer.alloc(size - position);
    fs.readSync(fd, buf, 0, buf.length, position);
    fs.closeSync(fd);
    position = size;
    process.stdout.write(buf);
  });
}
