import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { ensureConfig } from '../core/config-store.js';
import { commandExists, run } from '../core/processes.js';
import { ensureNgrokInstalled, hasValidNgrokConfig, addAuthtoken } from '../core/ngrok.js';
import { ensureChatMockInstalled } from '../core/chatmock.js';
import { command, header, info, ok, step } from '../core/ui.js';

export async function setup({ resetNgrokToken = false } = {}) {
  const { paths } = ensureConfig();
  header('Warp Gateway setup', 'OpenAI/Codex via ChatMock + a secure ngrok tunnel for Warp.');
  console.log(`Config: ${paths.config}`);
  info('No local model is required for ChatMock. You just need an OpenAI/Codex login.');

  if (!(await commandExists('node'))) throw new Error('Node.js was not found. Install Node.js 20+ first.');

  step(1, 3, 'ChatMock / OpenAI login bridge');
  const chatmock = await ensureChatMockInstalled();

  step(2, 3, 'ngrok tunnel');
  const ngrok = await ensureNgrokInstalled();
  await run(ngrok, ['version']);

  const rl = readline.createInterface({ input, output });
  try {
    if (!resetNgrokToken && await hasValidNgrokConfig(ngrok)) {
      const replace = await rl.question('ngrok config found. Replace authtoken? (y/N) ');
      resetNgrokToken = /^y/i.test(replace);
    }
    if (resetNgrokToken || !(await hasValidNgrokConfig(ngrok))) {
      console.log(`Get your ngrok authtoken: ${command('https://dashboard.ngrok.com/get-started/your-authtoken')}`);
      const token = await rl.question('Paste ngrok authtoken: ');
      if (!token.trim()) throw new Error('ngrok authtoken is required for the free tunnel');
      await addAuthtoken(ngrok, token.trim());
      ok('ngrok authtoken saved');
    } else {
      ok('Keeping existing ngrok authtoken');
    }

    step(3, 3, 'OpenAI/Codex OAuth');
    let loggedIn = false;
    try { await run(chatmock, ['info'], { stdio: 'ignore' }); loggedIn = true; } catch {}
    if (loggedIn) {
      const again = await rl.question('ChatMock appears available. Run OAuth login again? (y/N) ');
      if (/^y/i.test(again)) await run(chatmock, ['login']);
    } else {
      const login = await rl.question('Run OpenAI/Codex OAuth login now? (Y/n) ');
      if (!/^n/i.test(login)) await run(chatmock, ['login']);
    }
  } finally {
    rl.close();
  }

  ok(`Setup complete. Start with: ${command('warp-gateway run')}`);
}
