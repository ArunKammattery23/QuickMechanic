param(
    [string]$Project = 'project-8d23d91b-6c41-4eea-8cf',
    [string]$Region = 'us-central1',
    [string]$Service = 'quickmechanic-api',
    [string]$Instance = 'quickmechanic-db'
)
$ErrorActionPreference = 'Stop'

gcloud run services update $Service --region=$Region --project=$Project --max-instances=2 --min=0 --quiet
if ($LASTEXITCODE -ne 0) { throw 'Cloud Run cost cap failed.' }

gcloud sql instances patch $Instance --project=$Project --storage-auto-increase-limit=10 --quiet
if ($LASTEXITCODE -ne 0) { throw 'Cloud SQL storage cap failed.' }

Write-Host 'Applied cost caps: Cloud Run min=0/max=2; Cloud SQL storage limited to 10 GB.'
