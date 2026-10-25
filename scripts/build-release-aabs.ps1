# Builds release App Bundles (.aab) for all three Flutter apps.
# Output lands in build/app/outputs/bundle/release/app-release.aab inside each app.
# Run from the repo root in a shell with Flutter on PATH.
param(
  [string[]]$Apps = @('customer_app', 'provider_app', 'admin_app')
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

# Google sign-in needs the public Web OAuth client ID compiled into the apps.
# Taken from GOOGLE_WEB_CLIENT_ID or config/google-auth.local.json (webClientId).
$googleWebClientId = $env:GOOGLE_WEB_CLIENT_ID
$googleConfig = Join-Path $root 'config/google-auth.local.json'
if (-not $googleWebClientId -and (Test-Path $googleConfig)) {
  $googleWebClientId = (Get-Content $googleConfig -Raw | ConvertFrom-Json).webClientId
}
$defines = @()
if ($googleWebClientId) {
  $defines += "--dart-define=GOOGLE_WEB_CLIENT_ID=$googleWebClientId"
  Write-Host "Google sign-in: enabled ($googleWebClientId)" -ForegroundColor DarkGray
} else {
  Write-Warning 'Google sign-in will be disabled: no GOOGLE_WEB_CLIENT_ID and no config/google-auth.local.json'
}

foreach ($app in $Apps) {
  $dir = Join-Path $root "apps/$app"
  if (-not (Test-Path $dir)) { Write-Warning "skip: $app not found at $dir"; continue }

  Write-Host ""
  Write-Host "=== $app ===" -ForegroundColor Cyan
  Push-Location $dir
  try {
    Write-Host "flutter clean"       -ForegroundColor DarkGray; flutter clean | Out-Null
    Write-Host "flutter pub get"     -ForegroundColor DarkGray; flutter pub get
    Write-Host "flutter build appbundle --release" -ForegroundColor DarkGray
    flutter build appbundle --release @defines

    $aab = "build/app/outputs/bundle/release/app-release.aab"
    if (Test-Path $aab) {
      $full = (Resolve-Path $aab).Path
      $size = [math]::Round((Get-Item $aab).Length / 1MB, 2)
      Write-Host "[OK] $app ready: $full ($size MB)" -ForegroundColor Green
    } else {
      Write-Warning "[FAIL] $app did not produce $aab"
    }
  } finally {
    Pop-Location
  }
}

Write-Host ""
Write-Host "All done. Upload each app-release.aab to Play Console (Closed testing -> Create new release)."
