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
- One-command startup after first setup.

## First-time setup

Run the guided setup script. It installs/checks dependencies, opens the ngrok token page, lets you paste your token, runs ChatMock login, and can start everything at the end.

### Windows

```powershell
cd "$HOME\Downloads\warp-gateway"
.\setup.ps1
```

### macOS / Linux

```bash
cd ~/Downloads/warp-gateway
./setup.sh
```

During setup:

1. Get an ngrok token from: <https://dashboard.ngrok.com/get-started/your-authtoken>
2. Paste it when prompted.
3. Log in with your ChatGPT/Codex account when ChatMock asks.

## Daily use

### Quiet background mode

Starts ChatMock, the gateway, and ngrok in the background. Prints the dynamic Warp endpoint URL and copies it to your clipboard when possible.

Windows:

```powershell
cd "$HOME\Downloads\warp-gateway"
.\run-background.ps1
```

macOS / Linux:

```bash
cd ~/Downloads/warp-gateway
./run-background.sh
```

### Log mode

Use this if you want the terminal to stay open and show gateway requests/logs while you use Warp.

Windows:

```powershell
cd "$HOME\Downloads\warp-gateway"
.\run-with-logs.ps1
```

macOS / Linux:

```bash
cd ~/Downloads/warp-gateway
./run-with-logs.sh
```

## Warp configuration

After startup, use the printed values in Warp:

```txt
Endpoint URL: https://xxxx.ngrok-free.dev/v1
API key: dev-key-change-me
Model: gpt-5.4
```

The ngrok URL is dynamic and may change when ngrok restarts, so use the URL printed by the latest startup run.

## Model names

Recommended:

```txt
Codex/ChatMock: gpt-5.4
Local LLM with Lemonade: use one of the printed lemonade/... models
```

ChatMock models:

```txt
gpt-5.5
gpt-5.4
gpt-5.4-mini
gpt-5.2
gpt-5.3-codex
gpt-5.3-codex-spark
```

Lemonade models are discovered automatically from:

```txt
http://127.0.0.1:13305/v1/models
```

They appear in Warp as:

```txt
lemonade/<model-name>
```

Example:

```txt
lemonade/Gemma-4-26B-A4B-it-GGUF
```

On macOS, use the ChatMock/Codex model unless you also install and configure Lemonade there.

## Status and shutdown

### Windows

```powershell
.\status.ps1
.\stop-all.ps1
```

### macOS / Linux

```bash
./status.sh
./stop-all.sh
```

## Important files

```txt
setup.*            guided first-time setup
run-background.*   starts everything quietly in the background
run-with-logs.*    starts dependencies and keeps gateway logs in the terminal
status.*           prints running status and endpoint URL
stop-all.*         stops background services
config/            model and gateway configuration
src/               small gateway server
```
