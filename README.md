# Warp ChatMock Gateway

A small Warp-facing OpenAI-compatible gateway for using [ChatMock](https://github.com/RayBytes/ChatMock) with Warp Custom Inference Endpoint.

ChatMock does the Codex/ChatGPT login and serves an OpenAI-compatible API on `127.0.0.1:8000/v1`.
This gateway adds a stable local endpoint on `127.0.0.1:8320/v1`, optional model aliases, and a Bearer token before you expose it with ngrok.

```txt
Warp -> ngrok -> warp-gateway :8320 -> ChatMock :8000 -> Codex/ChatGPT account
```

## 1. Install ChatMock

PowerShell:

```powershell
cd "$HOME\Downloads\warp-gateway"
.\scripts\install-chatmock.ps1
```

Git Bash:

```bash
cd ~/Downloads/warp-gateway
./scripts/install-chatmock.sh
```

## 2. Login

```powershell
.\scripts\login-chatmock.ps1
```

or:

```bash
./scripts/login-chatmock.sh
```

## Daily use: one command, background mode

After you have logged in once, just run one command.

Windows PowerShell:

```powershell
cd "$HOME\Downloads\warp-gateway"
.\run-background.ps1
```

macOS/Linux:

```bash
cd ~/Downloads/warp-gateway
./run-background.sh
```

It starts ChatMock, the gateway, and ngrok hidden/in the background, then prints and copies the Warp endpoint URL.

Check status:

```powershell
.\status.ps1       # Windows
./status.sh        # macOS/Linux
```

Stop all background services:

```powershell
.\stop-all.ps1     # Windows
./stop-all.sh      # macOS/Linux
```

### macOS notes

On your Mac there is no local LLM dependency in this setup. It only needs ChatMock + Node + ngrok:

```bash
brew install node python ngrok/ngrok/ngrok
python3 -m pip install --upgrade chatmock
chatmock login
ngrok config add-authtoken YOUR_TOKEN
./run-background.sh
```

## Manual mode

### 3. Start ChatMock

Keep this terminal open:

```powershell
.\scripts\start-chatmock.ps1
```

or:

```bash
./scripts/start-chatmock.sh
```

ChatMock should now be on:

```txt
http://127.0.0.1:8000/v1
```

## 4. Start the Warp gateway

Open a second terminal:

```powershell
cd "$HOME\Downloads\warp-gateway"
.\scripts\start-warp-gateway.ps1
```

or:

```bash
cd ~/Downloads/warp-gateway
npm start
```

Test:

```bash
curl http://127.0.0.1:8320/health
curl -H "Authorization: Bearer dev-key-change-me" http://127.0.0.1:8320/v1/models
```

## 5. Expose to Warp

Open a third terminal:

```powershell
.\scripts\start-ngrok.ps1
```

or:

```bash
ngrok http 8320
```

In Warp Custom Inference Endpoint:

```txt
Endpoint URL: https://YOUR-NGROK.ngrok-free.app/v1
API key: dev-key-change-me
Model: gpt-5.4
```

Other configured models:

```txt
gpt-5.5
gpt-5.4
gpt-5.4-mini
gpt-5.2
gpt-5.3-codex
gpt-5.3-codex-spark
codex/gpt-5.3-codex
```

## Config

Edit `config/config.json`.

Default ChatMock adapter:

```json
"chatmock": {
  "enabled": true,
  "baseUrl": "http://127.0.0.1:8000/v1",
  "apiKey": "anything",
  "models": [
    { "id": "gpt-5.4", "name": "ChatMock GPT-5.4" }
  ]
}
```

Optional Lemonade/local LLM adapter is included but disabled. Enable it only if you run Lemonade on a different port, e.g. `8001`, to avoid conflicting with ChatMock.

## Files

```txt
config/config.json          gateway config
src/server.js               tiny OpenAI-compatible forwarding server
src/adapters/               upstream adapter code
scripts/*chatmock*          install/login/start ChatMock
scripts/start-ngrok.ps1     expose gateway to Warp
```
