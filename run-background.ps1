$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$RunDir = Join-Path $Root ".run"
$LogDir = Join-Path $Root "logs"
$Ngrok = Join-Path $Root "tools\ngrok\ngrok.exe"

New-Item -ItemType Directory -Force -Path $RunDir, $LogDir | Out-Null
Set-Location $Root

function Start-Bg($Name, $Command) {
  $PidFile = Join-Path $RunDir "$Name.pid"
  $OutLog = Join-Path $LogDir "$Name.out.log"
  $ErrLog = Join-Path $LogDir "$Name.err.log"

  if (Test-Path $PidFile) {
    $OldPid = Get-Content $PidFile -ErrorAction SilentlyContinue
    if ($OldPid -and (Get-Process -Id $OldPid -ErrorAction SilentlyContinue)) {
      Write-Host "$Name already running (PID $OldPid)" -ForegroundColor Yellow
      return
    }
  }

  $P = Start-Process powershell -WindowStyle Hidden -PassThru -RedirectStandardOutput $OutLog -RedirectStandardError $ErrLog -ArgumentList @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-Command",
    "cd '$Root'; $Command"
  )
  Set-Content -Path $PidFile -Value $P.Id
  Write-Host "Started $Name (PID $($P.Id))" -ForegroundColor Green
}

function Wait-Http($Url, $Headers = @{}, $Seconds = 20) {
  $Deadline = (Get-Date).AddSeconds($Seconds)
  while ((Get-Date) -lt $Deadline) {
    try {
      return Invoke-RestMethod -Uri $Url -Headers $Headers -TimeoutSec 2
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }
  throw "Timed out waiting for $Url"
}

if (-not (Get-Command chatmock -ErrorAction SilentlyContinue)) {
  Write-Host "ChatMock not found. Installing..." -ForegroundColor Yellow
  python -m pip install --upgrade chatmock
}

if (-not (Test-Path $Ngrok)) {
  Write-Host "Local ngrok not found. Installing..." -ForegroundColor Yellow
  & (Join-Path $Root "install-ngrok.ps1")
}

Write-Host "Starting services in background..." -ForegroundColor Cyan
Start-Bg "chatmock" "chatmock serve"
Start-Sleep -Seconds 2
Start-Bg "gateway" "node src/server.js"
Start-Sleep -Seconds 1
Start-Bg "ngrok" "& '$Ngrok' http 8320"

Write-Host "Waiting for local services..." -ForegroundColor Cyan
Wait-Http "http://127.0.0.1:8320/health" | Out-Null

Write-Host "Waiting for ngrok public URL..." -ForegroundColor Cyan
$Tunnel = $null
$Deadline = (Get-Date).AddSeconds(25)
while ((Get-Date) -lt $Deadline) {
  try {
    $Tunnels = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -TimeoutSec 2
    $Tunnel = $Tunnels.tunnels | Where-Object { $_.proto -eq "https" } | Select-Object -First 1
    if ($Tunnel) { break }
  } catch {}
  Start-Sleep -Milliseconds 500
}

if (-not $Tunnel) {
  Write-Host "Services started, but could not read ngrok URL. Check logs/ngrok.err.log or open http://127.0.0.1:4040" -ForegroundColor Yellow
  exit 0
}

$Endpoint = "$($Tunnel.public_url)/v1"
Set-Content -Path (Join-Path $RunDir "endpoint.txt") -Value $Endpoint
Set-Clipboard $Endpoint

Write-Host "\nReady." -ForegroundColor Green
Write-Host "Warp Endpoint URL: $Endpoint" -ForegroundColor Green
Write-Host "API key:           dev-key-change-me"
Write-Host "Model:             gpt-5.4"
Write-Host "\nEndpoint copied to clipboard."
Write-Host "Stop everything with: .\stop-all.ps1"
