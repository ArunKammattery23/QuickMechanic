# Builds release App Bundles (.aab) for all three Flutter apps.
# Output lands in build/app/outputs/bundle/release/app-release.aab inside each app.
# Run from the repo root in a shell with Flutter on PATH.
param(
  [string[]]$Apps = @('customer_app', 'provider_app', 'admin_app')
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

foreach ($app in $Apps) {
  $dir = Join-Path $root "apps/$app"
  if (-not (Test-Path $dir)) { Write-Warning "skip: $app not found at $dir"; continue }

  Write-Host "`n=== $app ===" -ForegroundColor Cyan
  Push-Location $dir
  try {
    Write-Host "flutter clean"       -ForegroundColor DarkGray; flutter clean | Out-Null
    Write-Host "flutter pub get"     -ForegroundColor DarkGray; flutter pub get
    Write-Host "flutter build appbundle --release" -ForegroundColor DarkGray
    flutter build appbundle --release

    $aab = "build/app/outputs/bundle/release/app-release.aab"
    if (Test-Path $aab) {
      $full = (Resolve-Path $aab).Path
      $size = [math]::Round((Get-Item $aab).Length / 1MB, 2)
      Write-Host "✓ $app ready: $full ($size MB)" -ForegroundColor Green
    } else {
      Write-Warning "✗ $app did not produce $aab"
    }
  } finally {
    Pop-Location
  }
}

Write-Host "`nAll done. Upload each app-release.aab to Play Console → Closed testing → Create new release."
