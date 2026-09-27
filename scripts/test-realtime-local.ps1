param([switch]$Database, [string]$FlutterExecutable = 'flutter')
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
Push-Location $taskRoot
try {
    if ($Database) {
        docker info --format '{{.ServerVersion}}'
        if ($LASTEXITCODE -ne 0) { throw 'Start Docker Desktop before running database tests.' }
        docker compose up -d db redis
        if ($LASTEXITCODE -ne 0) { throw 'Local database startup failed.' }
        $taskReady = $false
        for ($taskAttempt = 0; $taskAttempt -lt 20; $taskAttempt++) {
            docker compose exec -T db pg_isready -U postgres -d QuickMechanic
            if ($LASTEXITCODE -eq 0) { $taskReady = $true; break }
            Start-Sleep -Seconds 1
        }
        if (-not $taskReady) { throw 'Local PostgreSQL did not become ready.' }
    }
    Push-Location backend
    try {
        node node_modules/typescript/bin/tsc -p apps/backend/tsconfig.app.json --noEmit --incremental false
        if ($LASTEXITCODE -ne 0) { throw 'Backend type check failed.' }
        $taskPreviousFlag = $env:RUN_LOCAL_DB_TESTS
        if ($Database) { $env:RUN_LOCAL_DB_TESTS = '1' }
        try {
            node node_modules/jest/bin/jest.js --runInBand --runTestsByPath apps/backend/src/location/realtime.spec.ts apps/backend/src/dispatch/wallet.local.spec.ts apps/backend/src/dispatch/pricing.local.spec.ts apps/backend/src/dispatch/money.spec.ts apps/backend/src/dispatch/razorpay.spec.ts apps/backend/src/users/performance.spec.ts
            if ($LASTEXITCODE -ne 0) { throw 'Backend tests failed.' }
        } finally { $env:RUN_LOCAL_DB_TESTS = $taskPreviousFlag }
    } finally { Pop-Location }
    foreach ($taskApp in @('customer_app', 'provider_app')) {
        Push-Location "apps/$taskApp"
        try {
            & $FlutterExecutable test --no-pub
            if ($LASTEXITCODE -ne 0) { throw "Flutter tests failed: $taskApp" }
        } finally { Pop-Location }
    }
} finally { Pop-Location }

