param(
  [ValidatePattern('^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$')]
  [string]$GoogleWebClientId,
  [string]$FlutterPath = 'C:\flutter\bin\flutter.bat'
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $PSBoundParameters.ContainsKey('GoogleWebClientId')) {
  $GoogleWebClientId = $env:GOOGLE_WEB_CLIENT_ID
  if (-not $GoogleWebClientId) {
    $googleConfigPath = Join-Path $projectRoot 'config\google-auth.local.json'
    if (Test-Path -LiteralPath $googleConfigPath) {
      try {
        $googleConfig = Get-Content -LiteralPath $googleConfigPath -Raw | ConvertFrom-Json
        $GoogleWebClientId = $googleConfig.webClientId
      } catch {
        throw "Unable to read the Google OAuth configuration at $googleConfigPath. Ensure it contains valid JSON with webClientId."
      }
    }
  }
}
if ([string]::IsNullOrWhiteSpace($GoogleWebClientId)) {
  throw 'Google Web client ID is missing. Set -GoogleWebClientId, GOOGLE_WEB_CLIENT_ID, or webClientId in config/google-auth.local.json.'
}
if ($GoogleWebClientId -notmatch '^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$') {
  throw 'GoogleWebClientId must be a Google OAuth Web client ID, not a client secret.'
}
if (-not (Test-Path -LiteralPath $FlutterPath)) {
  $FlutterPath = (Get-Command flutter -ErrorAction Stop).Source
}

# Build only against device loopback. connect-android-local.ps1 forwards it to
# the Docker-backed API. This script never builds for or deploys to the cloud.
foreach ($appName in @('customer_app', 'provider_app')) {
  $appRoot = Join-Path $projectRoot "apps\$appName"
  Push-Location -LiteralPath $appRoot
  try {
    & $FlutterPath pub get
    if ($LASTEXITCODE -ne 0) { throw "Dependency resolution failed for $appName." }
    & $FlutterPath build apk --debug --no-pub '--dart-define=APP_ENV=local' '--dart-define=API_BASE_URL=http://127.0.0.1:3000' "--dart-define=GOOGLE_WEB_CLIENT_ID=$GoogleWebClientId"
    if ($LASTEXITCODE -ne 0) { throw "Android build failed for $appName." }
    Write-Host "Built local Google-auth APK: $appRoot\build\app\outputs\flutter-apk\app-debug.apk"
  } finally {
    Pop-Location
  }
}
