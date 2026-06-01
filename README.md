# Warp ChatMock Gateway

A tiny local gateway that lets Warp use ChatMock/Codex and optional local LLMs through one OpenAI-compatible endpoint.

```txt
Warp -> ngrok -> local gateway -> ChatMock -> ChatGPT/Codex account
                         └── optional -> Lemonade local LLM
```

## What this gives you

- One Warp Custom Inference Endpoint URL.
- Codex/ChatGPT models via ChatMock.
- Optional local LLM models via Lemonade.
- Auto-discovery for Lemonade models when Lemonade is enabled/running.
- One run script that starts everything and shows gateway request logs.

## First-time setup

### Windows

```powershell
cd "$HOME\Downloads\warp-gateway"
.\scripts\windows\setup.ps1
```

### macOS / Linux

```bash
cd ~/Downloads/warp-gateway
./scripts/macos/setup.sh
```

The setup script will:

1. Create a local `config/config.json` with a random gateway API key.
2. Install/update ChatMock.
3. Install/check ngrok.
4. Open the ngrok token page: <https://dashboard.ngrok.com/get-started/your-authtoken>
5. Let you paste your ngrok token.
6. Run `chatmock login` for your ChatGPT/Codex account.

## Daily use

Run one script. It starts ChatMock and ngrok in the background, then runs the gateway in the current terminal so you can see request logs.

### Windows

```powershell
cd "$HOME\Downloads\warp-gateway"
.\scripts\windows\run.ps1
```

### macOS / Linux

```bash
cd ~/Downloads/warp-gateway
./scripts/macos/run.sh
```

Keep this terminal open while using Warp. Press `Ctrl+C` to stop the gateway, ChatMock, and ngrok.

## Warp configuration

After startup, use the printed values in Warp:

```txt
Endpoint URL: https://xxxx.ngrok-free.dev/v1
API key: <printed by the run script>
Model: gpt-5.5
```

The ngrok URL is dynamic and may change when ngrok restarts, and the gateway API key is read from your local config. Use the values printed by the latest run.

## Model names

Recommended:

```txt
Codex/ChatMock: gpt-5.5
Local LLM with Lemonade: use one of the printed lemonade/... models
```

ChatMock model:

```txt
gpt-5.5
```

Thinking-level aliases:

```txt
gpt-5.5-minimal
gpt-5.5-low
gpt-5.5-medium
gpt-5.5-high
gpt-5.5-xhigh
```

These aliases all route to `gpt-5.5` and add a `reasoning_effort` override for ChatMock. Use them in Warp's model field when you want a specific thinking level.

Lemonade models are discovered automatically from:

```txt
http://127.0.0.1:13305/v1/models
```

They appear in Warp as:

```txt
lemonade/<model-name>
```

On macOS, use the ChatMock/Codex model unless you also install and configure Lemonade there.

## Important files

```txt
scripts/windows/setup.ps1   Windows first-time setup
scripts/windows/run.ps1     Windows daily run script
scripts/macos/setup.sh      macOS/Linux first-time setup
scripts/macos/run.sh        macOS/Linux daily run script
config/                     model and gateway configuration
src/                        small gateway server
```
