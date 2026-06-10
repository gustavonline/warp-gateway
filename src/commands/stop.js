import { readState, writeState } from '../core/config-store.js';
import { killPid } from '../core/processes.js';
import { header, ok } from '../core/ui.js';

export async function stop() {
  const state = readState();
  header('Stopping Warp Gateway');
  if (state.gatewayPid) { killPid(state.gatewayPid); ok(`Stopped gateway (${state.gatewayPid})`); }
  if (state.ngrokPid) { killPid(state.ngrokPid); ok(`Stopped ngrok (${state.ngrokPid})`); }
  if (state.chatmockPid) { killPid(state.chatmockPid); ok(`Stopped ChatMock (${state.chatmockPid})`); }
  writeState({ ...state, gatewayPid: undefined, ngrokPid: undefined, chatmockPid: undefined });
}
