$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

function Test-Command($Name) {
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

Write-Host "=== Warp ChatMock Gateway setup ===" -ForegroundColor Cyan
Write-Host "Project: $Root"

if (-not (Test-Command python)) {
  Write-Error "Python was not found. Install Python first, then rerun this script."
  exit 1
}

if (-not (Test-Command node)) {
  Write-Error "Node.js was not found. Install Node.js 20+, then rerun this script."
  exit 1
}

Write-Host "\n[1/5] Installing/updating ChatMock..." -ForegroundColor Cyan
python -m pip install --upgrade chatmock

Write-Host "\n[2/5] ChatMock login" -ForegroundColor Cyan
Write-Host "If you are not already logged in, a browser/login flow will start."
Write-Host "Yes: login with your OpenAI ChatGPT/Codex account via the OAuth/browser flow."
$doLogin = Read-Host "Run 'chatmock login' now? (Y/n)"
if ($doLogin -notmatch '^(n|N)$') {
  chatmock login
}

Write-Host "\n[3/5] Starting ChatMock server in a new window on http://127.0.0.1:8000/v1" -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-ExecutionPolicy", "Bypass",
  "-Command",
  "cd '$Root'; chatmock serve"
)

Start-Sleep -Seconds 3

Write-Host "\n[4/5] Starting Warp gateway in a new window on http://127.0.0.1:8320/v1" -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-ExecutionPolicy", "Bypass",
  "-Command",
  "cd '$Root'; node src/server.js"
)

Start-Sleep -Seconds 2

Write-Host "\n[5/5] ngrok" -ForegroundColor Cyan
$LocalNgrok = Join-Path $Root "tools\ngrok\ngrok.exe"
if (-not (Test-Path $LocalNgrok)) {
  Write-Host "Local ngrok not found. Installing latest ngrok..." -ForegroundColor Yellow
  & (Join-Path $Root "install-ngrok.ps1")
}
$startNgrok = Read-Host "Start ngrok now? (Y/n)"
if ($startNgrok -notmatch '^(n|N)$') {
  Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy", "Bypass",
    "-Command",
    "cd '$Root'; .\scripts\start-ngrok.ps1"
  )
}

Write-Host "\n=== Warp settings ===" -ForegroundColor Green
Write-Host "Endpoint URL: https://YOUR-NGROK-DOMAIN.ngrok-free.app/v1"
Write-Host "API key:      dev-key-change-me"
Write-Host "Model:        gpt-5.4"
Write-Host "\nOther models: gpt-5.5, gpt-5.4-mini, gpt-5.2, gpt-5.3-codex, gpt-5.3-codex-spark"
Write-Host "\nLocal test:"
Write-Host "curl -H 'Authorization: Bearer dev-key-change-me' http://127.0.0.1:8320/v1/models"
