$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $Root

function Has-Command($Name) {
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

Write-Host "=== Warp ChatMock Gateway setup (Windows) ===" -ForegroundColor Cyan
Write-Host "Project: $Root"

Write-Host ""
Write-Host "[1/5] Creating local config..." -ForegroundColor Cyan
$ConfigPath = Join-Path $Root "config\config.json"
$ExampleConfigPath = Join-Path $Root "config\config.example.json"
if (-not (Test-Path $ConfigPath)) {
  Copy-Item $ExampleConfigPath $ConfigPath
  $GatewayKey = -join ((1..32) | ForEach-Object { '{0:x}' -f (Get-Random -Minimum 0 -Maximum 16) })
  $Config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
  $Config.gatewayApiKeys = @($GatewayKey)
  $Config | ConvertTo-Json -Depth 20 | Set-Content $ConfigPath
  Write-Host "Created config/config.json with a random gateway API key."
} else {
  Write-Host "Using existing config/config.json."
}

if (-not (Has-Command python)) {
  Write-Error "Python was not found. Install Python 3 first: https://www.python.org/downloads/"
  exit 1
}

if (-not (Has-Command node)) {
  Write-Error "Node.js was not found. Install Node.js 20+ first: https://nodejs.org/"
  exit 1
}

Write-Host ""
Write-Host "[2/5] Installing/updating ChatMock..." -ForegroundColor Cyan
python -m pip install --upgrade chatmock

Write-Host ""
Write-Host "[3/5] Installing/checking local ngrok..." -ForegroundColor Cyan
$NgrokDir = Join-Path $Root "tools\ngrok"
$NgrokZip = Join-Path $NgrokDir "ngrok.zip"
$NgrokExe = Join-Path $NgrokDir "ngrok.exe"
New-Item -ItemType Directory -Force -Path $NgrokDir | Out-Null
if (-not (Test-Path $NgrokExe)) {
  Invoke-WebRequest -Uri "https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip" -OutFile $NgrokZip
  Expand-Archive -Force $NgrokZip $NgrokDir
}
& $NgrokExe version

Write-Host ""
Write-Host "[4/5] ngrok token" -ForegroundColor Cyan
$NgrokConfigOk = $false
try {
  $ConfigCheck = & $NgrokExe config check 2>&1
  $NgrokConfigOk = ($LASTEXITCODE -eq 0 -and ($ConfigCheck -join "`n") -match "Valid configuration")
} catch {}

if ($NgrokConfigOk) {
  Write-Host "ngrok already has a valid config/token."
  $ReplaceToken = Read-Host "Replace ngrok authtoken? (y/N)"
} else {
  $ReplaceToken = "y"
}

if ($ReplaceToken -match '^(y|Y)$') {
  $TokenUrl = "https://dashboard.ngrok.com/get-started/your-authtoken"
  Write-Host "Get your token here: $TokenUrl"
  $OpenNgrok = Read-Host "Open ngrok token page in your browser? (Y/n)"
  if ($OpenNgrok -notmatch '^(n|N)$') { Start-Process $TokenUrl }
  $Token = Read-Host "Paste ngrok authtoken"
  if (-not [string]::IsNullOrWhiteSpace($Token)) {
    & $NgrokExe config add-authtoken $Token
  } else {
    Write-Host "No token pasted; skipping token setup."
  }
}

Write-Host ""
Write-Host "[5/5] ChatMock login" -ForegroundColor Cyan
$ChatMockLoggedIn = $false
try {
  $ChatMockInfo = chatmock info 2>&1
  $ChatMockLoggedIn = ($LASTEXITCODE -eq 0 -and ($ChatMockInfo -join "`n") -match "Signed in")
} catch {}

if ($ChatMockLoggedIn) {
  Write-Host "ChatMock is already signed in."
  $Login = Read-Host "Run 'chatmock login' again? (y/N)"
} else {
  Write-Host "A browser/OAuth login may open. Log in with your ChatGPT/Codex account."
  $Login = Read-Host "Run 'chatmock login' now? (Y/n)"
}
if (($ChatMockLoggedIn -and $Login -match '^(y|Y)$') -or (-not $ChatMockLoggedIn -and $Login -notmatch '^(n|N)$')) { chatmock login }

Write-Host ""
Write-Host "Setup complete." -ForegroundColor Green
Write-Host "Start with: .\scripts\windows\run.ps1"
