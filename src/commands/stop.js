import { readState, writeState } from '../core/config-store.js';
import { killPid } from '../core/processes.js';

export async function stop() {
  const state = readState();
  if (state.gatewayPid) { killPid(state.gatewayPid); console.log(`Stopped gateway (${state.gatewayPid})`); }
  if (state.ngrokPid) { killPid(state.ngrokPid); console.log(`Stopped ngrok (${state.ngrokPid})`); }
  if (state.chatmockPid) { killPid(state.chatmockPid); console.log(`Stopped ChatMock (${state.chatmockPid})`); }
  writeState({ ...state, gatewayPid: undefined, ngrokPid: undefined, chatmockPid: undefined });
}
