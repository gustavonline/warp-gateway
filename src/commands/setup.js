import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { ensureConfig } from '../core/config-store.js';
import { commandExists, run } from '../core/processes.js';
import { ensureNgrokInstalled, hasValidNgrokConfig, addAuthtoken } from '../core/ngrok.js';

export async function setup() {
  const { paths } = ensureConfig();
  console.log('=== Warp Gateway setup ===');
  console.log(`Config: ${paths.config}`);

  const py = await commandExists('python3') ? 'python3' : 'python';
  if (!(await commandExists(py))) throw new Error('Python was not found. Install Python 3 first.');
  if (!(await commandExists('node'))) throw new Error('Node.js was not found. Install Node.js 20+ first.');

  console.log('\n[1/3] Installing/updating ChatMock...');
  await run(py, ['-m', 'pip', 'install', '--upgrade', 'chatmock']);

  console.log('\n[2/3] Checking ngrok...');
  const ngrok = await ensureNgrokInstalled();
  await run(ngrok, ['version']);

  const rl = readline.createInterface({ input, output });
  try {
    if (await hasValidNgrokConfig(ngrok)) {
      console.log('ngrok already has a valid authtoken/config. Keeping it unchanged.');
    } else {
      console.log('Get your ngrok authtoken here: https://dashboard.ngrok.com/get-started/your-authtoken');
      const token = await rl.question('Paste ngrok authtoken: ');
      if (!token.trim()) throw new Error('ngrok authtoken is required for the free tunnel');
      await addAuthtoken(ngrok, token.trim());
    }

    console.log('\n[3/3] ChatMock login...');
    let loggedIn = false;
    try { await run('chatmock', ['info'], { stdio: 'ignore' }); loggedIn = true; } catch {}
    if (loggedIn) {
      const again = await rl.question('ChatMock appears available. Run chatmock login again? (y/N) ');
      if (/^y/i.test(again)) await run('chatmock', ['login']);
    } else {
      const login = await rl.question('Run chatmock login now? (Y/n) ');
      if (!/^n/i.test(login)) await run('chatmock', ['login']);
    }
  } finally {
    rl.close();
  }

  console.log('\nSetup complete. Start with: warp-gateway run');
}
