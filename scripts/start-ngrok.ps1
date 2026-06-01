$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$LocalNgrok = Join-Path $Root "tools\ngrok\ngrok.exe"

if (Test-Path $LocalNgrok) {
  & $LocalNgrok http 8320
} else {
  ngrok http 8320
}
