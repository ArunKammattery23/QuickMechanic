param([ValidateRange(1024, 65535)][int]$LocalApiPort = 3000)
$ErrorActionPreference = 'Stop'

try {
  $health = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$LocalApiPort/services" -TimeoutSec 5
  if ($health.StatusCode -ne 200) { throw "HTTP $($health.StatusCode)" }
} catch {
  throw "The local QuickMechanic API is not responding on PC port $LocalApiPort. Start the local API before connecting Android. $($_.Exception.Message)"
}

$adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
if (-not (Test-Path -LiteralPath $adb)) {
  throw "Android Debug Bridge was not found at $adb"
}

$devices = & $adb devices | Select-Object -Skip 1 | ForEach-Object {
  if ($_ -match '^([^\s]+)\s+device$') { $Matches[1] }
} | Where-Object { $_ }

if (-not $devices) {
  throw 'No authorized Android device is connected over USB.'
}

foreach ($device in $devices) {
  & $adb -s $device reverse tcp:3000 "tcp:$LocalApiPort"
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to forward device port 3000 to PC port $LocalApiPort for device $device"
  }
  Write-Host "Connected $device port 3000 to the local QuickMechanic API on PC port $LocalApiPort."
}

Write-Host 'Keep the USB cable connected while using the local development API.'
