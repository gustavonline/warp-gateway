# Warp ChatMock Gateway

Ultra simpelt setup der gør, at Warp kan bruge ChatMock/Codex via et OpenAI-compatible endpoint.

Flowet er:

```txt
Warp -> ngrok -> lokal gateway -> ChatMock -> ChatGPT/Codex konto
```

## Første gang

Installer dependencies og login:

### Windows

```powershell
cd "$HOME\Downloads\warp-gateway"
.\scripts\install-chatmock.ps1
.\scripts\login-chatmock.ps1
.\install-ngrok.ps1
```

Tilføj din ngrok token:

```powershell
.\tools\ngrok\ngrok.exe config add-authtoken DIN_NGROK_TOKEN
```

### macOS / Linux

```bash
cd ~/Downloads/warp-gateway
./scripts/install-chatmock.sh
./scripts/login-chatmock.sh
brew install ngrok/ngrok/ngrok
ngrok config add-authtoken DIN_NGROK_TOKEN
```

## Daglig brug

### Windows

Start alt i baggrunden:

```powershell
cd "$HOME\Downloads\warp-gateway"
.\run-background.ps1
```

Stop alt:

```powershell
.\stop-all.ps1
```

Status:

```powershell
.\status.ps1
```

### macOS / Linux

Start alt i baggrunden:

```bash
cd ~/Downloads/warp-gateway
./run-background.sh
```

Stop alt:

```bash
./stop-all.sh
```

Status:

```bash
./status.sh
```

## Warp config

Når `run-background` er kørt, printer den en URL som denne:

```txt
https://xxxx.ngrok-free.dev/v1
```

Brug den i Warp Custom Inference Endpoint:

```txt
Endpoint URL: https://xxxx.ngrok-free.dev/v1
API key: dev-key-change-me
Model: gpt-5.4
```

Andre modeller:

```txt
gpt-5.5
gpt-5.4-mini
gpt-5.2
gpt-5.3-codex
gpt-5.3-codex-spark
```

## Filer

```txt
run-background.*   starter ChatMock, gateway og ngrok
stop-all.*         stopper alt
status.*           viser status og endpoint
src/               lille gateway server
config/            model/gateway config
```
