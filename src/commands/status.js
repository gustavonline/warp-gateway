import { ensureConfig, readState } from '../core/config-store.js';
import { isPidRunning } from '../core/processes.js';

export async function status() {
  const { paths, config } = ensureConfig();
  const state = readState();
  const apiKey = config.gatewayApiKeys?.[0] || '';
  const endpoint = state.endpointUrl || '';

  console.log('Warp Gateway Status');
  console.log(`Config:   ${paths.config}`);
  console.log(`Logs:     ${paths.logDir}`);
  console.log(`Gateway:  ${state.gatewayPid && isPidRunning(state.gatewayPid) ? `running (${state.gatewayPid})` : 'stopped'}`);
  console.log(`ChatMock: ${state.chatmockPid && isPidRunning(state.chatmockPid) ? `running (${state.chatmockPid})` : 'stopped'}`);
  console.log(`ngrok:    ${state.ngrokPid && isPidRunning(state.ngrokPid) ? `running (${state.ngrokPid})` : 'stopped'}`);
  console.log(`Updated:  ${state.updatedAt || 'never'}`);
  console.log('');
  console.log('Warp settings');
  console.log(`Endpoint URL: ${endpoint || 'not known yet - run warp-gateway run'}`);
  console.log(`API key:      ${apiKey || 'missing - run warp-gateway run'}`);
  console.log('Model:        gpt-5.5');
  console.log('Aliases:      gpt-5.5-minimal, gpt-5.5-low, gpt-5.5-medium, gpt-5.5-high, gpt-5.5-xhigh');
  if (state.gatewayKeyReason) console.log(`Key reason:   ${state.gatewayKeyReason}`);
}
