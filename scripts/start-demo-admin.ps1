param([int]$ApiPort = 3003)
$ErrorActionPreference = 'Stop'
$Port = 3001
$projectRoot = Split-Path -Parent $PSScriptRoot
$dashboardRoot = Join-Path $projectRoot 'apps/admin_dashboard_web'
$env:NEXT_PUBLIC_API_URL = "http://127.0.0.1:$ApiPort"
$output = Join-Path $dashboardRoot "demo-admin-$Port.log"
$errors = Join-Path $dashboardRoot "demo-admin-$Port.error.log"
$process = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', 'npm run dev' -WorkingDirectory $dashboardRoot -WindowStyle Hidden -RedirectStandardOutput $output -RedirectStandardError $errors -PassThru
Write-Host "Started local admin dashboard on port $Port, using API port $ApiPort (PID $($process.Id))."
