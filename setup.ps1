$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

function Has-Command($Name) {
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

Write-Host "=== Warp ChatMock Gateway setup ===" -ForegroundColor Cyan
Write-Host "This will install ChatMock, install/update ngrok, configure your ngrok token, and run ChatMock login."
Write-Host "Project: $Root"

if (-not (Has-Command python)) {
  Write-Error "Python was not found. Install Python 3 first: https://www.python.org/downloads/"
  exit 1
}

if (-not (Has-Command node)) {
  Write-Error "Node.js was not found. Install Node.js 20+ first: https://nodejs.org/"
  exit 1
}

Write-Host "\n[1/4] Installing/updating ChatMock..." -ForegroundColor Cyan
python -m pip install --upgrade chatmock

Write-Host "\n[2/4] Installing/updating local ngrok..." -ForegroundColor Cyan
.\install-ngrok.ps1

$Ngrok = Join-Path $Root "tools\ngrok\ngrok.exe"
if (-not (Test-Path $Ngrok)) {
  Write-Error "ngrok was not installed at $Ngrok"
  exit 1
}

Write-Host "\n[3/4] ngrok token" -ForegroundColor Cyan
$TokenUrl = "https://dashboard.ngrok.com/get-started/your-authtoken"
Write-Host "Get your token here: $TokenUrl"
$OpenNgrok = Read-Host "Open ngrok token page in your browser? (Y/n)"
if ($OpenNgrok -notmatch '^(n|N)$') {
  Start-Process $TokenUrl
}
$Token = Read-Host "Paste ngrok authtoken (leave empty to skip if already configured)"
if (-not [string]::IsNullOrWhiteSpace($Token)) {
  & $Ngrok config add-authtoken $Token
} else {
  Write-Host "Skipping token setup."
}

Write-Host "\n[4/4] ChatMock login" -ForegroundColor Cyan
Write-Host "A browser/OAuth login may open. Log in with your ChatGPT/Codex account."
$Login = Read-Host "Run 'chatmock login' now? (Y/n)"
if ($Login -notmatch '^(n|N)$') {
  chatmock login
}

Write-Host "\nSetup complete." -ForegroundColor Green
$RunNow = Read-Host "Start everything now in the background? (Y/n)"
if ($RunNow -notmatch '^(n|N)$') {
  .\run-background.ps1
} else {
  Write-Host "Later, start with: .\run-background.ps1"
  Write-Host "That command will print the dynamic ngrok Endpoint URL to paste into Warp."
  Write-Host "Warp values will be: Endpoint URL = printed by run-background, API key = dev-key-change-me, Model = gpt-5.4"
}
