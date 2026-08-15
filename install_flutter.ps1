# Requires running in Windows PowerShell

$ErrorActionPreference = "Stop"

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  Automated Flutter SDK Installer (Windows)  " -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

$InstallDir = "C:\src"
$ZipPath = "$InstallDir\flutter.zip"
$FlutterUrl = "https://storage.googleapis.com/flutter_infra_release/releases/stable/windows/flutter_windows_3.24.0-stable.zip"

# Step 1: Create the target directory
if (-Not (Test-Path -Path $InstallDir)) {
    Write-Host "`n[1/4] Creating installation directory at $InstallDir..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
} else {
    Write-Host "`n[1/4] Installation directory $InstallDir already exists." -ForegroundColor Green
}

# Step 2: Download Flutter
Write-Host "[2/4] Downloading Flutter SDK (~1.2 GB). This will take a few minutes depending on your internet speed..." -ForegroundColor Yellow
Invoke-WebRequest -Uri $FlutterUrl -OutFile $ZipPath
Write-Host "Download complete!" -ForegroundColor Green

# Step 3: Extract the SDK
Write-Host "[3/4] Extracting the SDK (This might take another minute or two)..." -ForegroundColor Yellow
Expand-Archive -Path $ZipPath -DestinationPath $InstallDir -Force
Write-Host "Extraction complete!" -ForegroundColor Green

# Step 4: Add to system PATH (for the current session)
$env:Path += ";C:\src\flutter\bin"

# Step 5: Clean up the ZIP file to save disk space
Remove-Item -Path $ZipPath -Force

Write-Host "[4/4] Successfully installed Flutter at C:\src\flutter!" -ForegroundColor Green
Write-Host "`nInitializing your QuickMechanic Flutter Project now..." -ForegroundColor Cyan

# Navigate to the QuickMechanic folder
Set-Location -Path "C:\Users\aruns\Desktop\DREAM\QuickMechanic"

# Scaffold the Mobile App
C:\src\flutter\bin\flutter.bat create --org com.quickmechanic --project-name mobile_app apps/mobile_app

Write-Host "`n==============================================" -ForegroundColor Cyan
Write-Host " ALL DONE! The mobile_app folder is ready! " -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "`nPlease tell the AI: 'I have run the script and the app is ready!' " -ForegroundColor Yellow
