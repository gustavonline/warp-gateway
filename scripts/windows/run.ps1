$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
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
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "cd '$Root'; $Command"
  )
  Set-Content -Path $PidFile -Value $P.Id
  Write-Host "Started $Name (PID $($P.Id))" -ForegroundColor Green
}

function Stop-Bg($Name) {
  $PidFile = Join-Path $RunDir "$Name.pid"
  if (Test-Path $PidFile) {
    $PidValue = Get-Content $PidFile -ErrorAction SilentlyContinue
    if ($PidValue -and (Get-Process -Id $PidValue -ErrorAction SilentlyContinue)) {
      Stop-Process -Id $PidValue -Force -ErrorAction SilentlyContinue
      Write-Host "Stopped $Name (PID $PidValue)" -ForegroundColor DarkGray
    }
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
  }
}

function Wait-Http($Url, $Seconds = 20) {
  $Deadline = (Get-Date).AddSeconds($Seconds)
  while ((Get-Date) -lt $Deadline) {
    try { return Invoke-RestMethod -Uri $Url -TimeoutSec 2 } catch { Start-Sleep -Milliseconds 500 }
  }
  throw "Timed out waiting for $Url"
}

function Stop-Port($Port) {
  $Listeners = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  foreach ($Listener in $Listeners) {
    $PidValue = $Listener.OwningProcess
    if ($PidValue -and (Get-Process -Id $PidValue -ErrorAction SilentlyContinue)) {
      Stop-Process -Id $PidValue -Force -ErrorAction SilentlyContinue
      Write-Host "Stopped existing process on port $Port (PID $PidValue)" -ForegroundColor DarkGray
    }
  }
}

if (-not (Get-Command chatmock -ErrorAction SilentlyContinue)) { python -m pip install --upgrade chatmock }
if (-not (Test-Path $Ngrok)) {
  Write-Error "ngrok not found. Run .\scripts\windows\setup.ps1 first."
  exit 1
}

try {
  Write-Host "Starting ChatMock and ngrok in background, gateway logs in this terminal..." -ForegroundColor Cyan
  Start-Bg "chatmock" "chatmock serve"
  Start-Sleep -Seconds 2
  Start-Bg "ngrok" "& '$Ngrok' http 8320"
  Start-Sleep -Seconds 2

  # Clean up any gateway left behind by an older script/run.
  Stop-Port 8320

  $Endpoint = $null
  $Deadline = (Get-Date).AddSeconds(25)
  while ((Get-Date) -lt $Deadline) {
    try {
      $Tunnels = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -TimeoutSec 2
      $Tunnel = $Tunnels.tunnels | Where-Object { $_.proto -eq "https" } | Select-Object -First 1
      if ($Tunnel) { $Endpoint = "$($Tunnel.public_url)/v1"; break }
    } catch {}
    Start-Sleep -Milliseconds 500
  }

  if ($Endpoint) {
    Set-Clipboard $Endpoint
    Write-Host ""
    Write-Host "Warp config:" -ForegroundColor Green
    Write-Host "Endpoint URL: $Endpoint"
    Write-Host "API key:      dev-key-change-me"
    Write-Host "Model:        gpt-5.4"
    Write-Host ""
    Write-Host "Endpoint copied to clipboard."
  }

  Write-Host ""
  Write-Host "Gateway logs below. Keep this terminal open. Ctrl+C stops everything." -ForegroundColor Cyan
  node src/server.js
}
finally {
  Stop-Bg "ngrok"
  Stop-Bg "chatmock"
}
