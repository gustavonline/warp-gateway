import fs from 'node:fs';
import { ensureConfig } from '../core/config-store.js';
import { commandExists } from '../core/processes.js';
import { findNgrok, hasValidNgrokConfig, getNgrokVersion, isSupportedNgrokVersion } from '../core/ngrok.js';
import { findChatMock } from '../core/chatmock.js';
import { CURRENT_VERSION, compareVersions, getLatestVersion } from './update.js';
import { fail, header, ok, warn } from '../core/ui.js';

function recentLogMatches(file, pattern) {
  try {
    return pattern.test(fs.readFileSync(file, 'utf8').split('\n').slice(-80).join('\n'));
  } catch {
    return false;
  }
}

export async function doctor() {
  const { paths, config } = ensureConfig();
  const checks = [];
  checks.push(['Node.js', true, process.version]);
  checks.push(['Python', await commandExists('python3') || await commandExists('python'), 'required for ChatMock']);
  const chatmock = await findChatMock();
  checks.push(['ChatMock command', Boolean(chatmock), chatmock || 'run setup if missing']);
  const ngrok = await findNgrok();
  const ngrokVersion = ngrok ? await getNgrokVersion(ngrok) : undefined;
  checks.push(['ngrok command', Boolean(ngrok), ngrok || 'run setup/install ngrok']);
  checks.push(['ngrok version', isSupportedNgrokVersion(ngrokVersion), ngrokVersion?.raw || 'minimum supported by free accounts is 3.20.0']);
  const ngrokConfigOk = ngrok ? await hasValidNgrokConfig(ngrok) : false;
  const ngrokLogHasInvalidToken = recentLogMatches(paths.ngrokErr, /ERR_NGROK_107|authentication failed|invalid.*authtoken/i);
  checks.push(['ngrok authtoken', ngrokConfigOk && !ngrokLogHasInvalidToken, ngrokLogHasInvalidToken ? 'recent ngrok run says token is invalid - run setup --reset-ngrok-token' : 'configured once during setup']);
  checks.push(['Gateway API key', Boolean(config.gatewayApiKeys?.[0]), 'generated on first run if missing']);
  let latest = '';
  try { latest = await getLatestVersion(); } catch {}
  checks.push(['CLI version', !latest || compareVersions(latest, CURRENT_VERSION) <= 0, latest ? `${CURRENT_VERSION} installed, ${latest} latest` : `${CURRENT_VERSION} installed`]);
  header('Warp Gateway Doctor');
  console.log(`Config: ${paths.config}`);
  for (const [name, passed, detail] of checks) {
    const line = `${name} - ${detail}`;
    if (passed) ok(line);
    else if (name === 'ngrok authtoken') fail(line);
    else warn(line);
  }
}
