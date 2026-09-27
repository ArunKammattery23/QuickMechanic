param([switch]$SkipDownload)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$downloadDir = Join-Path $taskRoot 'data/routing/download'
New-Item -ItemType Directory -Path $downloadDir -Force | Out-Null
$extract = Join-Path $downloadDir 'kerala.osm.pbf'
$checksum = Join-Path $downloadDir 'kerala.osm.pbf.md5'
$source = 'https://download.openstreetmap.fr/extracts/asia/india'

if (-not (Test-Path -LiteralPath $extract)) {
  if ($SkipDownload) { throw "No Kerala extract found at $extract" }
  Invoke-WebRequest -Uri "$source/kerala.osm.pbf" -OutFile $extract
}
if (-not (Test-Path -LiteralPath $checksum)) {
  if ($SkipDownload) { throw "No checksum found at $checksum" }
  Invoke-WebRequest -Uri "$source/kerala.osm.pbf.md5" -OutFile $checksum
}
$expected = ((Get-Content -LiteralPath $checksum -Raw).Trim() -split '\s+')[0].ToLowerInvariant()
$actual = (Get-FileHash -LiteralPath $extract -Algorithm MD5).Hash.ToLowerInvariant()
if ($expected -ne $actual) { throw 'Kerala road extract checksum does not match. Do not use this file.' }

& (Join-Path $PSScriptRoot 'start-local-routing.ps1') -PbfPath $extract
if ($LASTEXITCODE -ne 0) { throw 'Local routing preparation failed.' }
