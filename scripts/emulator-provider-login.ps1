$ErrorActionPreference = 'Stop'
$sdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$adb = Join-Path $sdk 'platform-tools\adb.exe'
$credentialsPath = Join-Path (Split-Path $PSScriptRoot -Parent) 'play-store-assets\reviewer-credentials.local.json'
$credentials = Get-Content -LiteralPath $credentialsPath -Raw | ConvertFrom-Json

function Send-AdbText([string]$value) {
    # Android input text uses %s for spaces. Pass the value as a process argument so
    # reviewer credentials never appear in logs or generated command text.
    $encoded = $value.Replace(' ', '%s')
    & $adb -s emulator-5554 shell input text $encoded | Out-Null
}

function Clear-FocusedField {
    & $adb -s emulator-5554 shell input keyevent 123 | Out-Null
    1..96 | ForEach-Object { & $adb -s emulator-5554 shell input keyevent 67 | Out-Null }
}

& $adb -s emulator-5554 shell input tap 500 1135 | Out-Null
Clear-FocusedField
Send-AdbText ([string]$credentials.provider.email)
& $adb -s emulator-5554 shell input tap 500 1325 | Out-Null
Clear-FocusedField
Send-AdbText ([string]$credentials.provider.password)
& $adb -s emulator-5554 shell input keyevent 4 | Out-Null
Start-Sleep -Milliseconds 400
& $adb -s emulator-5554 shell input tap 500 1630 | Out-Null
Start-Sleep -Seconds 8
& $adb -s emulator-5554 shell screencap -p /sdcard/provider-after-login.png | Out-Null
& $adb -s emulator-5554 pull /sdcard/provider-after-login.png (Join-Path (Split-Path $PSScriptRoot -Parent) 'play-store-assets\provider-after-login.png') | Out-Null
