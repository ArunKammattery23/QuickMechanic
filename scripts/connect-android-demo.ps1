$ErrorActionPreference = 'Stop'
$adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
$devices = & $adb devices | Select-Object -Skip 1 | ForEach-Object {
  if ($_ -match '^([^\s]+)\s+device$') { $Matches[1] }
}
if (-not $devices) { throw 'Connect and authorize your Android phone first.' }
foreach ($device in $devices) {
  & $adb -s $device reverse tcp:3000 tcp:3002
  if ($LASTEXITCODE -ne 0) { throw "Forwarding failed for $device" }
}
Write-Host 'Phones now use the isolated dummy-payment API (PC port 3002). No real money.'
