param([Parameter(Mandatory=$true)][string]$AdminEmail)
$ErrorActionPreference='Stop'
$taskRoot=Split-Path -Parent $PSScriptRoot
$taskNames=@('NODE_ENV','PAYMENT_MODE','DB_HOST','DB_PORT','DB_NAME','DB_USER','DB_PASSWORD','REDIS_HOST','REDIS_PORT','PORT','TS_NODE_PROJECT','QM_DEMO_ADMIN_EMAIL','QM_DEMO_ADMIN_PASSWORD')
$taskSaved=@{}
foreach($taskName in $taskNames){$taskSaved[$taskName]=[Environment]::GetEnvironmentVariable($taskName,'Process')}
Push-Location $taskRoot
try {
    docker compose up -d db redis
    if($LASTEXITCODE -ne 0){throw 'Start Docker Desktop and retry.'}
    $taskReady=$false
    for($taskAttempt=0;$taskAttempt -lt 30;$taskAttempt++){
        docker compose exec -T db pg_isready -U postgres -d QuickMechanic
        if($LASTEXITCODE -eq 0){$taskReady=$true;break}
        Start-Sleep -Seconds 1
    }
    if(-not $taskReady){throw 'Local database is not ready.'}
    $taskExists=docker compose exec -T db psql -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'QuickMechanicDemo'"
    if($LASTEXITCODE -ne 0){throw 'Could not check demo database.'}
    if(($taskExists -join '').Trim() -ne '1'){
        docker compose exec -T db createdb -U postgres QuickMechanicDemo
        if($LASTEXITCODE -ne 0){throw 'Could not create demo database.'}
    }
    $env:NODE_ENV='development';$env:PAYMENT_MODE='simulation'
    $env:DB_HOST='127.0.0.1';$env:DB_PORT='5432';$env:DB_NAME='QuickMechanicDemo';$env:DB_USER='postgres'
    $env:DB_PASSWORD=if($env:QM_LOCAL_DB_PASSWORD){$env:QM_LOCAL_DB_PASSWORD}else{'password123'}
    $env:REDIS_HOST='127.0.0.1';$env:REDIS_PORT='6379';$env:PORT='3000'
    $env:QM_DEMO_ADMIN_EMAIL=$AdminEmail
    $taskPassword=Read-Host 'Demo admin password (12+ characters; existing passwords are not overwritten)' -AsSecureString
    $taskPointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($taskPassword)
    try{$env:QM_DEMO_ADMIN_PASSWORD=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($taskPointer)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taskPointer)}
    Push-Location backend
    try{
        $env:TS_NODE_PROJECT='tsconfig.json'
        node -r ts-node/register -r tsconfig-paths/register scripts/prepare-payment-demo.ts
        if($LASTEXITCODE -ne 0){throw 'Demo initialization failed.'}
        Remove-Item Env:QM_DEMO_ADMIN_PASSWORD
        Write-Host 'TEST MODE on port 3000. Run npm run dev in apps/admin_dashboard_web in another terminal.'
        npm run start:dev
    }finally{Pop-Location}
}finally{
    foreach($taskName in $taskNames){[Environment]::SetEnvironmentVariable($taskName,$taskSaved[$taskName],'Process')}
    Pop-Location
}
