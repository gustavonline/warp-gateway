#!/usr/bin/env node
import { setup } from './commands/setup.js';
import { runCommand } from './commands/run.js';
import { start } from './commands/start.js';
import { status } from './commands/status.js';
import { logs } from './commands/logs.js';
import { configCommand } from './commands/config.js';
import { doctor } from './commands/doctor.js';
import { stop } from './commands/stop.js';
import { update, CURRENT_VERSION, notifyIfUpdateAvailable } from './commands/update.js';

const version = CURRENT_VERSION;
const [cmd = 'run', ...args] = process.argv.slice(2);

function help() {
  console.log(`Warp Gateway ${version}

Quick start:
  warp-gateway setup                  First-time setup: ngrok token + ChatMock login
  warp-gateway start                  Start in background, then return to your shell
  warp-gateway status                 Show Warp URL, API key, model, and process status
  warp-gateway stop                   Stop background gateway, ngrok, and ChatMock

Foreground/debug:
  warp-gateway run                    Run in this terminal and stream logs
  warp-gateway logs --tail            Follow gateway request logs
  warp-gateway doctor                 Check dependencies and config
  warp-gateway update                 Update this CLI from npm
  warp-gateway update --check         Only check for updates

Providers/config:
  warp-gateway config                 Show config help
  warp-gateway config providers       List providers
  warp-gateway config enable lmstudio Enable LM Studio
  warp-gateway config enable lemonade Enable Lemonade

Options:
  --rotate-key                        Force a new gateway API key on run/start

Default command when no command is given: run`);
}

function argValue(flag, fallback) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
}

try {
  if (!['--help', '-h', 'help', '--version', '-v', 'update'].includes(cmd)) await notifyIfUpdateAvailable();

  if (cmd === '--help' || cmd === '-h' || cmd === 'help') help();
  else if (cmd === '--version' || cmd === '-v') console.log(version);
  else if (cmd === 'setup') await setup();
  else if (cmd === 'run') await runCommand({ rotate: args.includes('--rotate-key') });
  else if (cmd === 'start') await start({ rotate: args.includes('--rotate-key') });
  else if (cmd === 'status') await status();
  else if (cmd === 'logs') await logs({ lines: argValue('-n', argValue('--lines', '50')), file: argValue('--file', 'gateway'), follow: args.includes('--tail') || args.includes('-f') });
  else if (cmd === 'config') await configCommand(args);
  else if (cmd === 'doctor') await doctor();
  else if (cmd === 'update') await update({ checkOnly: args.includes('--check') || args.includes('-c') });
  else if (cmd === 'stop') await stop();
  else {
    console.error(`Unknown command: ${cmd}\n`);
    help();
    process.exitCode = 1;
  }
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
