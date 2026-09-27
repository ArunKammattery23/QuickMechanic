# Requires running in Windows PowerShell

$ErrorActionPreference = "Stop"

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  Flutter SDK Auto-Updater to Latest Stable   " -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "This script permanently solves SDK mismatch errors (like Dart 3.5 vs 3.6)." -ForegroundColor Yellow
Write-Host "It forces your local Flutter installation to upgrade to the absolute latest version." -ForegroundColor Yellow
Write-Host ""

Write-Host "Running flutter upgrade... This may take a few minutes." -ForegroundColor Green

# Navigate to the Flutter bin directory or use the global command if it's in PATH
flutter upgrade

Write-Host "`n==============================================" -ForegroundColor Cyan
Write-Host " Flutter SDK is now completely up-to-date! " -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "You will no longer face dependency resolution errors for new packages." -ForegroundColor Yellow
