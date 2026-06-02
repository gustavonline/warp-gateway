# Warp Gateway TODO

## Goal

Make Warp Gateway a clean, free, simple npm-installed CLI while keeping the gateway modular and publish-safe.

Target UX:

```bash
npm install -g @gustavonline/warp-gateway
warp-gateway setup
warp-gateway run
```

Daily run should print and copy the current Warp values:

```txt
Endpoint URL: https://xxxx.ngrok-free.dev/v1
API key:      <gateway key, rotated only when endpoint URL changes>
Model:        gpt-5.5
```

`ngrok` free dynamic URLs are accepted as a constraint. The ngrok authtoken is configured once during setup and should not be changed by the gateway. On each run the CLI should compare the current ngrok public URL with the last saved URL:

- If the URL is unchanged, keep the existing gateway API key so Warp settings do not need to change.
- If the URL changed, generate and save a new gateway API key and print both new values clearly.
- If no gateway API key exists yet, generate one.
- If no ngrok authtoken/config exists, ask for it during setup/doctor/run recovery.

## Current state

- Project is currently a local script-based app in `~/Downloads/warp-gateway`.
- `package.json` is private and has no CLI `bin` entry.
- Windows/macOS setup and run scripts work but require `cd` into the project.
- Config currently lives in `config/config.json` inside the project.
- Local runtime files are ignored: `.run/`, `logs/`, `tools/`, `config/config.json`.
- Gateway already exposes OpenAI-compatible routes:
  - `GET /v1/models`
  - `POST /v1/chat/completions`
  - `POST /v1/responses`
- Adapter architecture already has a generic `openai-compatible` adapter with model discovery support.

## Docs checked

- npm Trusted Publishing docs
  - Use OIDC trusted publisher instead of long-lived npm tokens.
  - Workflow needs `permissions: id-token: write` and `contents: read`.
  - Configure trusted publisher on npm with GitHub owner, repo, and workflow filename.
- npm provenance docs
  - Publish from GitHub-hosted runner.
  - Use `npm publish --provenance --access public` for first public publish.
- GitHub Actions npm publishing docs
  - Use `actions/setup-node` with npm registry URL.
  - Release workflow should run install/test before publish.
- ngrok Agent API docs
  - Local agent API is `http://127.0.0.1:4040/api` with no auth because it is local-only.
  - Tunnel details include `public_url`; current polling strategy is valid.
- LM Studio OpenAI compatibility docs
  - Supports `GET /v1/models`, `POST /v1/responses`, `POST /v1/chat/completions`, etc.
  - Good fit for existing generic OpenAI-compatible adapter.

## Security / npm supply-chain requirements

- [ ] Prefer npm Trusted Publishing/OIDC over `NPM_TOKEN`.
- [ ] Add GitHub Actions release workflow with least permissions:
  - `contents: read`
  - `id-token: write`
- [ ] Add provenance publish: `npm publish --provenance --access public`.
- [ ] Add manual GitHub environment approval for publishing if possible.
- [ ] Recommend protected release tags, e.g. `v*`.
- [ ] Keep package dependency surface small.
- [ ] Avoid `postinstall`, `preinstall`, and hidden lifecycle scripts.
- [ ] Use `files` allowlist in `package.json` so only intended source/docs/scripts ship to npm.
- [ ] Ensure npm package excludes:
  - `config/config.json`
  - `.run/`
  - `logs/`
  - `tools/`
  - downloaded `ngrok` binaries/zips
  - `.env` and local secret files
- [ ] Add CI check for `npm pack --dry-run --json` and fail if forbidden files are included.
- [ ] Add secret scan/lightweight guard for obvious tokens in files being packed.
- [ ] Add tests or at least `node --check` for all source files before publish.
- [ ] Publish only from clean git release tags.

## CLI design

Package:

- npm name: `@gustavonline/warp-gateway`
- bin: `warp-gateway`
- optional short alias: `wgw`

Commands:

- [ ] `warp-gateway setup`
  - Create app config/state dirs.
  - Install/update ChatMock via Python pip if missing/outdated.
  - Install/check ngrok locally in app data dir or use existing `ngrok` on PATH.
  - Prompt for ngrok authtoken if needed.
  - Run ChatMock login if needed.
  - Configure provider defaults.
- [ ] `warp-gateway run`
  - Start ChatMock.
  - Start ngrok free tunnel to local gateway port.
  - Poll ngrok agent API for `public_url`.
  - Compare current URL against saved last URL.
  - Reuse existing gateway API key if URL is unchanged.
  - Rotate/generate gateway API key only if URL changed or key is missing.
  - Print Warp setup instructions and clearly say whether Warp settings need updating.
  - Copy endpoint URL to clipboard if possible.
  - Run gateway in foreground and stream request logs.
  - Ctrl+C stops gateway, ngrok, and ChatMock.
- [x] `warp-gateway start`
  - Background mode starts ChatMock, ngrok, and gateway.
  - Writes logs/state to app data dir.
  - Prints current Warp URL/API key and whether settings need updating.
- [x] `warp-gateway stop`
  - Stop background gateway, ngrok, and ChatMock processes from pid files.
- [ ] `warp-gateway status`
  - Show process status, current endpoint, current model list, log paths.
- [ ] `warp-gateway logs`
  - Show/tail incoming gateway requests and upstream errors.
  - Options: `-n`, `--tail`, `--requests`, `--errors`.
- [x] `warp-gateway config`
  - Show config path/settings.
  - List providers.
  - Enable/disable providers.
  - Set dotted config values such as provider base URLs.
- [ ] `warp-gateway doctor`
  - Check node, python, pip, chatmock, ngrok token, ports, Warp-ready endpoint.

## Filesystem layout

Move runtime/config out of the repo/package directory.

Suggested app dirs:

- Windows: `%APPDATA%/warp-gateway/`
- macOS: `~/Library/Application Support/warp-gateway/`
- Linux: `${XDG_CONFIG_HOME:-~/.config}/warp-gateway/`

Suggested contents:

```txt
config.json             user config, no per-run token by default
state.json              current endpoint, pids, timestamps
logs/gateway.log        incoming requests
logs/chatmock.out.log
logs/chatmock.err.log
logs/ngrok.out.log
logs/ngrok.err.log
tools/ngrok/            downloaded ngrok binary if not on PATH
```

## Modular architecture plan

Refactor into modules:

```txt
src/cli.js
src/commands/setup.js
src/commands/run.js
src/commands/status.js
src/commands/logs.js
src/commands/doctor.js
src/core/app-dirs.js
src/core/processes.js
src/core/logger.js
src/core/ngrok.js
src/core/chatmock.js
src/core/config-store.js
src/server/create-server.js
src/providers/index.js
src/providers/openai-compatible.js
src/providers/chatmock.js
src/providers/lm-studio.js
src/providers/lemonade.js
```

Provider interface draft:

```js
export async function createProvider(context, providerConfig) {
  return {
    id,
    name,
    async setup?.(),
    async health?.(),
    async discoverModels?.(),
    canHandle(modelId),
    async proxy({ pathname, body, headers, signal })
  };
}
```

Provider auth strategies to support later:

- `none` for local providers.
- `api-key` for normal OpenAI-compatible providers.
- `oauth` for providers that need browser login/device flow.
- `external-process` for providers like ChatMock that manage auth themselves.

Initial providers:

- [ ] ChatMock/Codex provider: default enabled, model aliases for thinking levels.
- [ ] LM Studio provider: default disabled or auto-enabled when detected at local URL.
- [ ] Lemonade provider: keep current model discovery support.
- [ ] Generic OpenAI-compatible provider: easy config block for future services.

## Behavior decisions

- [ ] Keep ngrok free dynamic URL. No paid/static-domain requirement.
- [ ] Store/check ngrok authtoken once during setup; ask again only if missing/invalid.
- [ ] Track last ngrok public URL in state/config.
- [ ] Reuse gateway API key while ngrok public URL is unchanged.
- [ ] Rotate gateway API key only when ngrok public URL changes, key is missing, or user explicitly requests rotation.
- [ ] Print current URL and API key every run, and clearly mark whether Warp settings need updating.
- [ ] Do not store ChatGPT/Codex credentials; let ChatMock own that auth.
- [ ] Keep gateway API bound to `127.0.0.1` locally.
- [ ] Require bearer token on all `/v1/*` routes exposed through ngrok.
- [ ] Log request method/path/model/status/duration, not prompt contents by default.
- [ ] Add verbose/debug mode if prompt/body logging is ever needed.

## Implementation phases

### Phase 1 — package + CLI skeleton

- [x] Make package publishable.
- [x] Add `bin` entry.
- [x] Add CLI commands while keeping existing scripts available in repo.
- [x] Add app-dir config/state/log handling.
- [x] Add `node --check`/basic test script.

### Phase 2 — run/setup parity

- [x] Port Windows/macOS setup logic into Node CLI.
- [x] Port run orchestration into Node CLI.
- [x] Preserve current output UX.
- [x] Add `logs`, `status`, `doctor`.
- [ ] Full manual end-to-end test on a fresh machine/install.

### Phase 3 — modular providers

- [ ] Refactor adapter system into provider registry.
- [ ] Add ChatMock provider wrapper.
- [x] Add LM Studio provider config/discovery defaults.
- [x] Keep Lemonade support.
- [x] Add `warp-gateway config` controls for providers.

### Phase 4 — CI/CD + npm hardening

- [x] Add GitHub Actions CI workflow.
- [x] Add GitHub Actions npm publish workflow.
- [x] Add npm pack allowlist/forbidden-file check.
- [x] Add Trusted Publishing setup instructions to README.
- [x] Add release checklist.

### Phase 5 — docs polish

- [x] Rewrite README around npm install.
- [x] Keep one-line setup/run instructions.
- [x] Document Warp config flow.
- [x] Document free ngrok URL-change behavior.
- [x] Document provider config examples.

## Open questions before coding

- [ ] Exact npm package name: `@gustavonline/warp-gateway`?
- [ ] Should the default command `warp-gateway` equal `warp-gateway run`?
- [ ] Should we include short alias `wgw`?
- [x] Gateway API key rotation policy decided: keep key stable while ngrok URL is stable; rotate only when ngrok URL changes, key is missing, or user explicitly requests rotation.
- [ ] Should background `start` be implemented now or later?
