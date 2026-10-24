$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$credentials = Get-Content -LiteralPath (Join-Path $root 'play-store-assets\reviewer-credentials.local.json') -Raw | ConvertFrom-Json
$body = @{ email = [string]$credentials.provider.email; password = [string]$credentials.provider.password } | ConvertTo-Json
$response = Invoke-RestMethod -Method Post -Uri ([string]$credentials.api + '/auth/login') -ContentType 'application/json' -Body $body
$token = [string]$response.accessToken
[pscustomobject]@{
  api = [string]$credentials.api
  properties = @($response.PSObject.Properties.Name)
  role = [string]$response.role
  tokenSegmentCount = $token.Split('.').Count
  tokenLength = $token.Length
} | ConvertTo-Json
