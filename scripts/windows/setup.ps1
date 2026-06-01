$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $Root

function Has-Command($Name) {
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

Write-Host "=== Warp ChatMock Gateway setup (Windows) ===" -ForegroundColor Cyan
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
$NgrokDir = Join-Path $Root "tools\ngrok"
$NgrokZip = Join-Path $NgrokDir "ngrok.zip"
$NgrokExe = Join-Path $NgrokDir "ngrok.exe"
New-Item -ItemType Directory -Force -Path $NgrokDir | Out-Null
Invoke-WebRequest -Uri "https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip" -OutFile $NgrokZip
Expand-Archive -Force $NgrokZip $NgrokDir
& $NgrokExe version

Write-Host "\n[3/4] ngrok token" -ForegroundColor Cyan
$TokenUrl = "https://dashboard.ngrok.com/get-started/your-authtoken"
Write-Host "Get your token here: $TokenUrl"
$OpenNgrok = Read-Host "Open ngrok token page in your browser? (Y/n)"
if ($OpenNgrok -notmatch '^(n|N)$') { Start-Process $TokenUrl }
$Token = Read-Host "Paste ngrok authtoken (leave empty to skip if already configured)"
if (-not [string]::IsNullOrWhiteSpace($Token)) {
  & $NgrokExe config add-authtoken $Token
} else {
  Write-Host "Skipping token setup."
}

Write-Host "\n[4/4] ChatMock login" -ForegroundColor Cyan
Write-Host "A browser/OAuth login may open. Log in with your ChatGPT/Codex account."
$Login = Read-Host "Run 'chatmock login' now? (Y/n)"
if ($Login -notmatch '^(n|N)$') { chatmock login }

Write-Host "\nSetup complete." -ForegroundColor Green
Write-Host "Start with: .\scripts\windows\run.ps1"
