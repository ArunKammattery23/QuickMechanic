param(
    [string]$Project = 'project-8d23d91b-6c41-4eea-8cf',
    [string]$Region = 'us-central1',
    [string]$Service = 'quickmechanic-api',
    [string]$Instance = 'quickmechanic-db'
)
$ErrorActionPreference = 'Stop'

# Rotate the database password without writing it to disk or command output.
$taskBytes = New-Object byte[] 36
$taskRng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try {
    $taskRng.GetBytes($taskBytes)
} finally {
    $taskRng.Dispose()
}
$taskPassword = [Convert]::ToBase64String($taskBytes).Replace('+', 'A').Replace('/', 'b').TrimEnd('=') + '!9q'

gcloud sql users set-password postgres --instance=$Instance --project=$Project --password=$taskPassword --quiet
if ($LASTEXITCODE -ne 0) { throw 'Cloud SQL password rotation failed.' }

# Restore the service immediately after rotation before running any optional data setup.
gcloud run services update $Service --region=$Region --project=$Project --max-instances=2 --min=0 --update-env-vars="DB_PASSWORD=$taskPassword" --quiet
if ($LASTEXITCODE -ne 0) { throw 'Cloud Run credential/scaling update failed.' }

$taskSql = gcloud sql instances describe $Instance --project=$Project --format=json | ConvertFrom-Json
$taskPreviousLocation = Get-Location
try {
    $env:QM_REVIEW_DB_HOST = ($taskSql.ipAddresses | Where-Object type -eq 'PRIMARY').ipAddress
    $env:QM_REVIEW_DB_PORT = '5432'
    $env:QM_REVIEW_DB_USER = 'postgres'
    $env:QM_REVIEW_DB_PASSWORD = $taskPassword
    $env:QM_REVIEW_DB_NAME = 'postgres'
    Set-Location (Join-Path $PSScriptRoot '../backend')
    npx ts-node --transpile-only scripts/finalize-play-review-users.ts
    if ($LASTEXITCODE -ne 0) { throw 'Reviewer-account finalization failed.' }
} finally {
    Set-Location $taskPreviousLocation
    Remove-Item Env:QM_REVIEW_DB_HOST, Env:QM_REVIEW_DB_PORT, Env:QM_REVIEW_DB_USER, Env:QM_REVIEW_DB_PASSWORD, Env:QM_REVIEW_DB_NAME -ErrorAction SilentlyContinue
}

# The service already uses the managed Cloud SQL socket, so public database access is unnecessary.
gcloud sql instances patch $Instance --project=$Project --clear-authorized-networks --connector-enforcement=REQUIRED --quiet
if ($LASTEXITCODE -ne 0) { throw 'Cloud SQL network hardening failed.' }

Remove-Variable taskPassword
Write-Host 'Cloud cost and access safeguards applied: Cloud Run max=2/min=0; Cloud SQL connector required; database password rotated.'
