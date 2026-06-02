import { ensureConfig } from '../core/config-store.js';
import { commandExists } from '../core/processes.js';
import { findNgrok, hasValidNgrokConfig, getNgrokVersion, isSupportedNgrokVersion } from '../core/ngrok.js';

export async function doctor() {
  const { paths, config } = ensureConfig();
  const checks = [];
  checks.push(['Node.js', true, process.version]);
  checks.push(['Python', await commandExists('python3') || await commandExists('python'), 'required for ChatMock']);
  checks.push(['ChatMock command', await commandExists('chatmock'), 'run setup if missing']);
  const ngrok = await findNgrok();
  const ngrokVersion = ngrok ? await getNgrokVersion(ngrok) : undefined;
  checks.push(['ngrok command', Boolean(ngrok), ngrok || 'run setup/install ngrok']);
  checks.push(['ngrok version', isSupportedNgrokVersion(ngrokVersion), ngrokVersion?.raw || 'minimum supported by free accounts is 3.20.0']);
  checks.push(['ngrok authtoken', ngrok ? await hasValidNgrokConfig(ngrok) : false, 'configured once during setup']);
  checks.push(['Gateway API key', Boolean(config.gatewayApiKeys?.[0]), 'generated on first run if missing']);
  console.log('Warp Gateway Doctor');
  console.log(`Config: ${paths.config}`);
  for (const [name, ok, detail] of checks) console.log(`${ok ? '[OK]  ' : '[WARN]'} ${name} - ${detail}`);
}
