$ErrorActionPreference = "SilentlyContinue"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$RunDir = Join-Path $Root ".run"

Write-Host "Warp Gateway status" -ForegroundColor Cyan

foreach ($Name in @("chatmock", "gateway", "ngrok")) {
  $PidFile = Join-Path $RunDir "$Name.pid"
  if (Test-Path $PidFile) {
    $PidValue = Get-Content $PidFile
    $Proc = Get-Process -Id $PidValue -ErrorAction SilentlyContinue
    if ($Proc) {
      Write-Host "$Name running (PID $PidValue)" -ForegroundColor Green
    } else {
      Write-Host "$Name pid file exists but process is not running" -ForegroundColor Yellow
    }
  } else {
    Write-Host "$Name not started by run-background.ps1" -ForegroundColor Yellow
  }
}

try {
  $Health = Invoke-RestMethod http://127.0.0.1:8320/health -TimeoutSec 2
  Write-Host "Gateway health OK. Models: $($Health.models -join ', ')" -ForegroundColor Green
} catch {
  Write-Host "Gateway health failed" -ForegroundColor Red
}

try {
  $Tunnels = Invoke-RestMethod http://127.0.0.1:4040/api/tunnels -TimeoutSec 2
  $Https = $Tunnels.tunnels | Where-Object { $_.proto -eq "https" } | Select-Object -First 1
  if ($Https) {
    Write-Host "ngrok endpoint: $($Https.public_url)/v1" -ForegroundColor Green
  } else {
    Write-Host "ngrok API reachable but no HTTPS tunnel found" -ForegroundColor Yellow
  }
} catch {
  Write-Host "ngrok API not reachable" -ForegroundColor Yellow
}
