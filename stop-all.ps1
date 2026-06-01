$ErrorActionPreference = "SilentlyContinue"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$RunDir = Join-Path $Root ".run"

if (-not (Test-Path $RunDir)) {
  Write-Host "No .run directory found. Nothing to stop."
  exit 0
}

foreach ($Name in @("ngrok", "gateway", "chatmock")) {
  $PidFile = Join-Path $RunDir "$Name.pid"
  if (Test-Path $PidFile) {
    $PidValue = Get-Content $PidFile
    if ($PidValue) {
      $Proc = Get-Process -Id $PidValue -ErrorAction SilentlyContinue
      if ($Proc) {
        Stop-Process -Id $PidValue -Force
        Write-Host "Stopped $Name (PID $PidValue)" -ForegroundColor Green
      } else {
        Write-Host "$Name was not running" -ForegroundColor Yellow
      }
    }
    Remove-Item $PidFile -Force
  }
}

Remove-Item (Join-Path $RunDir "endpoint.txt") -Force -ErrorAction SilentlyContinue
Write-Host "Done."
