param([int]$Port = 3003)
$ErrorActionPreference = 'Stop'
if ($Port -lt 1024 -or $Port -gt 65535) { throw 'Choose a port between 1024 and 65535.' }
$projectRoot = Split-Path -Parent $PSScriptRoot
$backendRoot = Join-Path $projectRoot 'backend'
$entry = Join-Path $backendRoot 'dist/apps/backend/main.js'
if (-not (Test-Path -LiteralPath $entry)) { throw 'Build the backend first with nest build.' }
$env:NODE_ENV = 'development'
$env:PAYMENT_MODE = 'simulation'
$env:DB_HOST = '127.0.0.1'
$env:DB_PORT = '5432'
$env:DB_NAME = 'QuickMechanicDemo'
$env:DB_USER = 'postgres'
$env:DB_PASSWORD = if ($env:QM_LOCAL_DB_PASSWORD) { $env:QM_LOCAL_DB_PASSWORD } else { 'password123' }
$env:REDIS_HOST = '127.0.0.1'
$env:REDIS_PORT = '6379'
$env:OSRM_BASE_URL = if ($env:QM_LOCAL_ROUTER_URL) { $env:QM_LOCAL_ROUTER_URL } else { 'http://127.0.0.1:5000' }
$env:PORT = [string]$Port
$output = Join-Path $backendRoot "demo-api-$Port.log"
$errors = Join-Path $backendRoot "demo-api-$Port.error.log"
$process = Start-Process -FilePath 'node' -ArgumentList 'dist/apps/backend/main.js' -WorkingDirectory $backendRoot -WindowStyle Hidden -RedirectStandardOutput $output -RedirectStandardError $errors -PassThru
Write-Host "Started isolated simulation API on port $Port (PID $($process.Id))."
