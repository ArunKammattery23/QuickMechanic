param(
    [int[]]$Pairs = @(500, 2500, 5000),
    [ValidateRange(0, 300)][int]$SoakSeconds = 100
)
$ErrorActionPreference = 'Stop'
if ($Pairs.Count -eq 0 -or ($Pairs | Where-Object { $_ -lt 1 -or $_ -gt 5000 })) {
    throw 'Each stage must have 1 through 5000 customer/provider pairs.'
}
$root = Split-Path -Parent $PSScriptRoot
$report = Join-Path $root 'play-store-assets/local-call-verification-2026-10-09'
New-Item -ItemType Directory -Force $report | Out-Null
$previousRun = $env:RUN_LOCAL_DB_TESTS
$previousPairs = $env:QM_SOCKET_PAIRS
$previousSoak = $env:QM_SOAK_SECONDS
Push-Location (Join-Path $root 'backend')
try {
    # The harness hard-codes loopback PostgreSQL/Redis, an isolated temporary
    # schema, and a local routing stub. It never sends load to cloud resources.
    $env:RUN_LOCAL_DB_TESTS = '1'
    $env:QM_SOAK_SECONDS = [string]$SoakSeconds
    foreach ($pairCount in $Pairs) {
        $env:QM_SOCKET_PAIRS = [string]$pairCount
        $log = Join-Path $report ('load-{0}-users.log' -f ($pairCount * 2))
        Write-Output ('Starting local stage: {0} users, {1}s soak' -f ($pairCount * 2), $SoakSeconds)
        & .\node_modules\.bin\jest.cmd --runInBand apps/backend/src/workflows.local.spec.ts --testNamePattern 'keeps concurrent authenticated sockets' *> $log
        $result = $LASTEXITCODE
        Get-Content -LiteralPath $log -Tail 20
        if ($result -ne 0) { throw "Local stage failed. See $log. Higher load was not started." }
    }
} finally {
    $env:RUN_LOCAL_DB_TESTS = $previousRun
    $env:QM_SOCKET_PAIRS = $previousPairs
    $env:QM_SOAK_SECONDS = $previousSoak
    Pop-Location
}
