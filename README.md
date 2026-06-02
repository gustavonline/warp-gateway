# Warp Gateway

A small free CLI gateway that lets Warp use ChatMock/Codex and local OpenAI-compatible LLMs through one custom inference endpoint.

```txt
Warp -> ngrok free tunnel -> local gateway -> ChatMock/Codex
                                      ├── LM Studio (optional)
                                      └── Lemonade (optional)
```

## Install

```bash
npm install -g @gustavonline/warp-gateway
warp-gateway setup
warp-gateway run
```

`setup` asks for your ngrok authtoken once and runs ChatMock login when needed.

ngrok token page: <https://dashboard.ngrok.com/get-started/your-authtoken>

## Daily use

```bash
warp-gateway run
```

Keep the terminal open while using Warp. Press `Ctrl+C` to stop the gateway, ChatMock, and ngrok.

The CLI prints the current Warp values:

```txt
Endpoint URL: https://xxxx.ngrok-free.dev/v1
API key:      <gateway key>
Model:        gpt-5.5
```

Free ngrok URLs can change. Warp Gateway stores the last URL and gateway key:

- if the ngrok URL is unchanged, the gateway key is reused and Warp settings should still work;
- if the ngrok URL changed, a new gateway key is generated and the terminal clearly says to update Warp;
- the ngrok authtoken itself is not rotated or changed by normal runs.

## Warp configuration

In Warp Settings, find **Custom Inference Endpoint** and use the values printed by `warp-gateway run`.

Recommended model:

```txt
gpt-5.5
```

Thinking aliases:

```txt
gpt-5.5-minimal
gpt-5.5-low
gpt-5.5-medium
gpt-5.5-high
gpt-5.5-xhigh
```

## Commands

```bash
warp-gateway setup              # first-time setup / repair
warp-gateway run                # start ChatMock, ngrok, and gateway in foreground
warp-gateway run --rotate-key   # force a new gateway API key
warp-gateway start              # start everything in the background
warp-gateway stop               # stop saved gateway/ChatMock/ngrok background pids
warp-gateway status             # show endpoint, API key, pids, and config paths
warp-gateway logs -n 50         # show recent gateway request logs
warp-gateway logs --tail        # follow gateway logs
warp-gateway logs --file ngrok  # show ngrok stdout log
warp-gateway config providers   # list providers
warp-gateway config enable lmstudio
warp-gateway config set adapters.lmstudio.baseUrl http://127.0.0.1:1234/v1
warp-gateway doctor             # check node/python/chatmock/ngrok/config
```

Short alias:

```bash
wgw run
```

## Config and logs

Runtime files are stored outside the npm package:

- Windows: `%APPDATA%/warp-gateway/`
- macOS: `~/Library/Application Support/warp-gateway/`
- Linux: `${XDG_CONFIG_HOME:-~/.config}/warp-gateway/`

Files include:

```txt
config.json
state.json
logs/gateway.log
logs/chatmock.out.log
logs/chatmock.err.log
logs/ngrok.out.log
logs/ngrok.err.log
tools/ngrok/        # local downloaded ngrok on Windows when needed
```

## Providers

Default:

- ChatMock/Codex on `http://127.0.0.1:8000/v1`

Optional/local:

- LM Studio on `http://127.0.0.1:1234/v1` with discovered models as `lmstudio/<model>`
- Lemonade on `http://127.0.0.1:13305/v1` with discovered models as `lemonade/<model>`

Provider config examples:

```bash
warp-gateway config providers
warp-gateway config enable lmstudio
warp-gateway config disable lemonade
warp-gateway config set adapters.lmstudio.baseUrl http://127.0.0.1:1234/v1
warp-gateway config set adapters.lemonade.baseUrl http://127.0.0.1:13305/v1
```

If the gateway is running, config changes restart it automatically. If it is stopped, run `warp-gateway start` afterwards.

The gateway uses a generic OpenAI-compatible provider shape, so more providers can be added via config later.

## npm publishing / supply-chain safety

This package is intended to be published with npm Trusted Publishing from GitHub Actions, not a long-lived npm token.

Recommended npm trusted publisher settings:

- GitHub owner/repo: `gustavonline/warp-chatmock-gateway`
- Workflow filename: `publish.yml`
- Allowed action: `npm publish`

Release flow:

```bash
npm test
git tag v0.3.0
git push origin v0.3.0
```

The publish workflow uses OIDC and provenance:

```bash
npm publish --provenance --access public
```

The package uses a `files` allowlist and `scripts/check-pack.js` to block local config, logs, tools, ngrok binaries, and secrets from being included in the npm tarball.
