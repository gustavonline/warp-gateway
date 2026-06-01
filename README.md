# Warp ChatMock Gateway

A tiny local gateway that lets Warp use ChatMock/Codex (and optionally a local Lemonade LLM) through a single OpenAI-compatible endpoint.

```txt
Warp -> ngrok -> local gateway -> ChatMock -> ChatGPT/Codex account
                         └── optional -> Lemonade local LLM
```

## What this gives you

- One Warp Custom Inference Endpoint URL.
- Codex/ChatGPT models via ChatMock.
- Optional local LLM models via Lemonade on machines where Lemonade is installed.
- One-command background startup after first setup.

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

### Windows

```powershell
cd "$HOME\Downloads\warp-gateway"
.\run-background.ps1
```

### macOS / Linux

```bash
cd ~/Downloads/warp-gateway
./run-background.sh
```

The script starts ChatMock, the gateway, and ngrok in the background. It prints the current Warp endpoint URL and copies it to your clipboard when possible.

## Warp configuration

After `run-background` finishes, use the printed values in Warp:

```txt
Endpoint URL: https://xxxx.ngrok-free.dev/v1
API key: dev-key-change-me
Model: gpt-5.4
```

The ngrok URL is dynamic and may change when ngrok restarts, so use the URL printed by the latest `run-background` run.

## Model names

Recommended:

```txt
Codex/ChatMock: gpt-5.4
Local LLM on Windows with Lemonade: lemonade/Gemma-4-26B-A4B-it-GGUF
```

Other ChatMock models:

```txt
gpt-5.5
gpt-5.4-mini
gpt-5.2
gpt-5.3-codex
gpt-5.3-codex-spark
```

Example local Lemonade models:

```txt
lemonade/Gemma-4-26B-A4B-it-GGUF
lemonade/Qwen3.6-35B-A3B-GGUF
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
run-background.*   starts ChatMock, gateway, and ngrok
status.*           prints running status and endpoint URL
stop-all.*         stops background services
config/            model and gateway configuration
src/               small gateway server
```
