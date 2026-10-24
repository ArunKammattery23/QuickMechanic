$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$keytool = (Get-Command keytool -ErrorAction Stop).Source
$signingDir = Join-Path $repoRoot 'apps/signing'
New-Item -ItemType Directory -Force -Path $signingDir | Out-Null

$apps = @(
    @{ Name = 'customer'; Folder = 'customer_app'; Dn = 'QuickMechanic Customer' },
    @{ Name = 'provider'; Folder = 'provider_app'; Dn = 'QuickMechanic Provider' },
    @{ Name = 'admin'; Folder = 'admin_app'; Dn = 'QuickMechanic Admin' }
)

foreach ($app in $apps) {
    $androidDir = Join-Path $repoRoot "apps/$($app.Folder)/android"
    $propertiesPath = Join-Path $androidDir 'key.properties'
    $keystorePath = Join-Path $signingDir "$($app.Name)-upload.jks"

    if ((Test-Path $propertiesPath) -or (Test-Path $keystorePath)) {
        throw "Signing material already exists for $($app.Name). No files were overwritten. Back up or inspect it before continuing."
    }

    $randomBytes = [byte[]]::new(32)
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($randomBytes)
    $password = [Convert]::ToHexString($randomBytes)

    & $keytool -genkeypair -v -keystore $keystorePath -storetype JKS `
        -storepass $password -keypass $password -alias upload `
        -keyalg RSA -keysize 2048 -validity 10000 `
        -dname "CN=$($app.Dn), OU=Mobile, O=QuickMechanic, L=India, C=IN"
    if ($LASTEXITCODE -ne 0) { throw "Could not generate upload key for $($app.Name)." }

    $properties = @(
        'storePassword=' + $password
        'keyPassword=' + $password
        'keyAlias=upload'
        "storeFile=../../signing/$($app.Name)-upload.jks"
    ) -join "`n"
    [System.IO.File]::WriteAllText($propertiesPath, $properties + "`n", [System.Text.UTF8Encoding]::new($false))
    [Array]::Clear($randomBytes, 0, $randomBytes.Length)
    $password = $null
    Write-Output "Created a private upload key for $($app.Name). Keep apps/signing/$($app.Name)-upload.jks and its Android key.properties file backed up securely."
}

Write-Output 'Signing setup complete. The private key files are ignored by Git.'
