# Warp ChatMock Gateway

A tiny local gateway that lets Warp use ChatMock/Codex through an OpenAI-compatible endpoint.

Flow:

```txt
Warp -> ngrok -> local gateway -> ChatMock -> ChatGPT/Codex account
```

## First-time setup

Install dependencies and log in.

### Windows

```powershell
cd "$HOME\Downloads\warp-gateway"
.\scripts\install-chatmock.ps1
.\scripts\login-chatmock.ps1
.\install-ngrok.ps1
```

Add your ngrok token:

```powershell
.\tools\ngrok\ngrok.exe config add-authtoken YOUR_NGROK_TOKEN
```

### macOS / Linux

```bash
cd ~/Downloads/warp-gateway
./scripts/install-chatmock.sh
./scripts/login-chatmock.sh
brew install ngrok/ngrok/ngrok
ngrok config add-authtoken YOUR_NGROK_TOKEN
```

## Daily use

### Windows

Start everything in the background:

```powershell
cd "$HOME\Downloads\warp-gateway"
.\run-background.ps1
```

Stop everything:

```powershell
.\stop-all.ps1
```

Check status:

```powershell
.\status.ps1
```

### macOS / Linux

Start everything in the background:

```bash
cd ~/Downloads/warp-gateway
./run-background.sh
```

Stop everything:

```bash
./stop-all.sh
```

Check status:

```bash
./status.sh
```

## Warp configuration

After running `run-background`, the script prints a URL like this:

```txt
https://xxxx.ngrok-free.dev/v1
```

Use it in Warp Custom Inference Endpoint:

```txt
Endpoint URL: https://xxxx.ngrok-free.dev/v1
API key: dev-key-change-me
Model: gpt-5.4
```

Recommended models:

```txt
Codex/ChatMock: gpt-5.4
Local LLM on Gustav's Windows machine: lemonade/Gemma-4-26B-A4B-it-GGUF
```

Other ChatMock models:

```txt
gpt-5.5
gpt-5.4-mini
gpt-5.2
gpt-5.3-codex
gpt-5.3-codex-spark
```

Local LLM models are only available on machines where Lemonade is installed and running. On macOS, use the ChatMock/Codex model unless you set up a local LLM there too.

## Files

```txt
run-background.*   starts ChatMock, the gateway, and ngrok
stop-all.*         stops everything
status.*           shows service status and endpoint URL
src/               small gateway server
config/            model/gateway configuration
```
