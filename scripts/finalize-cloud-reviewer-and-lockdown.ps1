param(
    [string]$Project = 'project-8d23d91b-6c41-4eea-8cf',
    [string]$Region = 'us-central1',
    [string]$Service = 'quickmechanic-api',
    [string]$Instance = 'quickmechanic-db'
)
$ErrorActionPreference = 'Stop'
$taskService = gcloud run services describe $Service --region=$Region --project=$Project --format=json | ConvertFrom-Json
$taskSql = gcloud sql instances describe $Instance --project=$Project --format=json | ConvertFrom-Json
$taskPreviousLocation = Get-Location
try {
    $env:QM_REVIEW_DB_HOST = ($taskSql.ipAddresses | Where-Object type -eq 'PRIMARY').ipAddress
    $env:QM_REVIEW_DB_PORT = '5432'
    $env:QM_REVIEW_DB_USER = 'postgres'
    $env:QM_REVIEW_DB_PASSWORD = ($taskService.spec.template.spec.containers[0].env | Where-Object name -eq 'DB_PASSWORD').value
    $env:QM_REVIEW_DB_NAME = 'postgres'
    Set-Location (Join-Path $PSScriptRoot '../backend')
    npx ts-node --transpile-only scripts/finalize-play-review-users.ts
    if ($LASTEXITCODE -ne 0) { throw 'Reviewer-account finalization failed.' }
} finally {
    Set-Location $taskPreviousLocation
    Remove-Item Env:QM_REVIEW_DB_HOST, Env:QM_REVIEW_DB_PORT, Env:QM_REVIEW_DB_USER, Env:QM_REVIEW_DB_PASSWORD, Env:QM_REVIEW_DB_NAME -ErrorAction SilentlyContinue
}
gcloud sql instances patch $Instance --project=$Project --clear-authorized-networks --connector-enforcement=REQUIRED --quiet
if ($LASTEXITCODE -ne 0) { throw 'Cloud SQL network hardening failed.' }
Write-Host 'Reviewer accounts finalized and Cloud SQL connector-only access applied.'
