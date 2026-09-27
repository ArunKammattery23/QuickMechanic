param(
    [Parameter(Mandatory = $true)][string]$PbfPath,
    [string]$Image = 'ghcr.io/project-osrm/osrm-backend:latest'
)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskSource = (Resolve-Path -LiteralPath $PbfPath).Path
if (-not $taskSource.EndsWith('.osm.pbf')) { throw 'Supply an OpenStreetMap .osm.pbf extract for your operating region.' }
$taskData = Join-Path $taskRoot 'data/routing'
New-Item -ItemType Directory -Path $taskData -Force | Out-Null
$taskPbf = Join-Path $taskData 'region.osm.pbf'
if (Test-Path -LiteralPath $taskPbf) { throw 'data/routing/region.osm.pbf already exists. Preserve or move the old dataset before preparing another.' }
Copy-Item -LiteralPath $taskSource -Destination $taskPbf
$taskMount = "type=bind,source=$taskData,target=/data"
docker run --rm --mount $taskMount $Image osrm-extract -p /opt/car.lua /data/region.osm.pbf
if ($LASTEXITCODE -ne 0) { throw 'OSRM extraction failed.' }
docker run --rm --mount $taskMount $Image osrm-partition /data/region.osrm
if ($LASTEXITCODE -ne 0) { throw 'OSRM partition failed.' }
docker run --rm --mount $taskMount $Image osrm-customize /data/region.osrm
if ($LASTEXITCODE -ne 0) { throw 'OSRM customization failed.' }
docker run -d --restart unless-stopped --name quickmechanic-osrm -p 127.0.0.1:5000:5000 --mount $taskMount $Image osrm-routed --algorithm mld /data/region.osrm
if ($LASTEXITCODE -ne 0) { throw 'OSRM startup failed.' }
Write-Output 'Set OSRM_BASE_URL=http://127.0.0.1:5000 in backend/.env.development and restart the API.'
