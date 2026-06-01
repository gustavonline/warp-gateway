$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Dir = Join-Path $Root "tools\ngrok"
$Zip = Join-Path $Dir "ngrok.zip"
$Exe = Join-Path $Dir "ngrok.exe"

New-Item -ItemType Directory -Force -Path $Dir | Out-Null

Write-Host "Downloading latest ngrok v3 to project tools folder..." -ForegroundColor Cyan
Invoke-WebRequest -Uri "https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip" -OutFile $Zip
Expand-Archive -Force $Zip $Dir

Write-Host "\nInstalled:" -ForegroundColor Green
& $Exe version

Write-Host "\nIf you have not already added your token, run:" -ForegroundColor Yellow
Write-Host "& '$Exe' config add-authtoken YOUR_TOKEN"
Write-Host "\nStart tunnel with:"
Write-Host ".\scripts\start-ngrok.ps1"
