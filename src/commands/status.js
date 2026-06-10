import { ensureConfig, readState } from '../core/config-store.js';
import { isPidRunning } from '../core/processes.js';
import { command, header, ok, warn } from '../core/ui.js';

export async function status() {
  const { paths, config } = ensureConfig();
  const state = readState();
  const apiKey = config.gatewayApiKeys?.[0] || '';
  const endpoint = state.endpointUrl || '';

  header('Warp Gateway Status');
  console.log(`Config:   ${paths.config}`);
  console.log(`Logs:     ${paths.logDir}`);
  const gatewayRunning = state.gatewayPid && isPidRunning(state.gatewayPid);
  const chatmockRunning = state.chatmockPid && isPidRunning(state.chatmockPid);
  const ngrokRunning = state.ngrokPid && isPidRunning(state.ngrokPid);
  console.log(`Gateway:  ${gatewayRunning ? `✅ running (${state.gatewayPid})` : '⏸️  stopped'}`);
  console.log(`ChatMock: ${chatmockRunning ? `✅ running (${state.chatmockPid})` : '⏸️  stopped'}`);
  console.log(`ngrok:    ${ngrokRunning ? `✅ running (${state.ngrokPid})` : '⏸️  stopped'}`);
  console.log(`Updated:  ${state.updatedAt || 'never'}`);
  console.log('');
  console.log('Warp settings');
  console.log(`Endpoint URL: ${endpoint ? command(endpoint) : 'not known yet - run warp-gateway run'}`);
  console.log(`API key:      ${apiKey ? command(apiKey) : 'missing - run warp-gateway run'}`);
  console.log(`Model:        ${command('gpt-5.5')}`);
  console.log('Aliases:      gpt-5.5-minimal, gpt-5.5-low, gpt-5.5-medium, gpt-5.5-high, gpt-5.5-xhigh');
  if (state.gatewayKeyReason) console.log(`Key reason:   ${state.gatewayKeyReason}`);
  if (gatewayRunning && chatmockRunning && ngrokRunning) ok('Everything looks ready for Warp.');
  else warn('Not fully running. Use: warp-gateway start');
}
