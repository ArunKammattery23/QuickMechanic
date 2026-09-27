param(
    [ValidateRange(1, 500)][int]$SocketPairs = 100,
    [ValidateRange(0, 300)][int]$SoakSeconds = 0,
    [string]$FlutterExecutable = 'flutter',
    [switch]$BackendOnly
)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskPreviousDb = $env:RUN_LOCAL_DB_TESTS
$taskPreviousPairs = $env:QM_SOCKET_PAIRS
$taskPreviousSoak = $env:QM_SOAK_SECONDS
Push-Location $taskRoot
try {
    docker compose up -d db redis
    if ($LASTEXITCODE -ne 0) { throw 'Start Docker Desktop and allow access to the local daemon.' }
    docker compose exec -T db pg_isready -U postgres -d QuickMechanic
    if ($LASTEXITCODE -ne 0) { throw 'Wait for local PostgreSQL to become ready, then retry.' }
    $env:RUN_LOCAL_DB_TESTS = '1'
    $env:QM_SOCKET_PAIRS = [string]$SocketPairs
    $env:QM_SOAK_SECONDS = [string]$SoakSeconds
    Push-Location backend
    try {
        npm run build
        if ($LASTEXITCODE -ne 0) { throw 'Backend build failed.' }
        npx tsc --noEmit -p tsconfig.json
        if ($LASTEXITCODE -ne 0) { throw 'Backend/test type checking failed.' }
        npm test -- --runInBand
        if ($LASTEXITCODE -ne 0) { throw 'Backend workflow tests failed.' }
    } finally { Pop-Location }
    if (-not $BackendOnly) {
        foreach ($taskApp in @('customer_app', 'provider_app')) {
            Push-Location "apps/$taskApp"
            try {
                & $FlutterExecutable pub get --offline
                if ($LASTEXITCODE -ne 0) { throw "Resolve Flutter dependencies for $taskApp first." }
                & $FlutterExecutable test --no-pub
                if ($LASTEXITCODE -ne 0) { throw "Flutter tests failed: $taskApp" }
            } finally { Pop-Location }
        }
        foreach ($taskDashboard in @('apps/admin_dashboard_web', 'admin-dashboard')) {
            Push-Location $taskDashboard
            try {
                npm run build
                if ($LASTEXITCODE -ne 0) { throw "Dashboard build failed: $taskDashboard" }
            } finally { Pop-Location }
        }
    }
} finally {
    $env:RUN_LOCAL_DB_TESTS = $taskPreviousDb
    $env:QM_SOCKET_PAIRS = $taskPreviousPairs
    $env:QM_SOAK_SECONDS = $taskPreviousSoak
    Pop-Location
}
