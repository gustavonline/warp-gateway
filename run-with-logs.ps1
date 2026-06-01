$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$RunDir = Join-Path $Root ".run"
$LogDir = Join-Path $Root "logs"
$Ngrok = Join-Path $Root "tools\ngrok\ngrok.exe"

New-Item -ItemType Directory -Force -Path $RunDir, $LogDir | Out-Null
Set-Location $Root

function Start-Bg($Name, $Command) {
  $PidFile = Join-Path $RunDir "$Name.pid"
  if (Test-Path $PidFile) {
    $OldPid = Get-Content $PidFile -ErrorAction SilentlyContinue
    if ($OldPid -and (Get-Process -Id $OldPid -ErrorAction SilentlyContinue)) {
      Write-Host "$Name already running (PID $OldPid)" -ForegroundColor Yellow
      return
    }
  }

  $OutLog = Join-Path $LogDir "$Name.out.log"
  $ErrLog = Join-Path $LogDir "$Name.err.log"
  $P = Start-Process powershell -WindowStyle Hidden -PassThru -RedirectStandardOutput $OutLog -RedirectStandardError $ErrLog -ArgumentList @(
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "cd '$Root'; $Command"
  )
  Set-Content -Path $PidFile -Value $P.Id
  Write-Host "Started $Name (PID $($P.Id))" -ForegroundColor Green
}

function Wait-Http($Url, $Seconds = 20) {
  $Deadline = (Get-Date).AddSeconds($Seconds)
  while ((Get-Date) -lt $Deadline) {
    try { return Invoke-RestMethod -Uri $Url -TimeoutSec 2 } catch { Start-Sleep -Milliseconds 500 }
  }
  throw "Timed out waiting for $Url"
}

if (-not (Get-Command chatmock -ErrorAction SilentlyContinue)) { python -m pip install --upgrade chatmock }
if (-not (Test-Path $Ngrok)) { & (Join-Path $Root "install-ngrok.ps1") }

Write-Host "Starting ChatMock and ngrok in background, gateway in this terminal..." -ForegroundColor Cyan
Start-Bg "chatmock" "chatmock serve"
Start-Sleep -Seconds 2
Start-Bg "ngrok" "& '$Ngrok' http 8320"
Start-Sleep -Seconds 2

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
  Write-Host "\nWarp config:" -ForegroundColor Green
  Write-Host "Endpoint URL: $Endpoint"
  Write-Host "API key:      dev-key-change-me"
  Write-Host "Model:        gpt-5.4"
  Write-Host "\nEndpoint copied to clipboard."
}

Write-Host "\nGateway logs below. Press Ctrl+C to stop viewing logs; run .\stop-all.ps1 to stop background services." -ForegroundColor Cyan
node src/server.js
