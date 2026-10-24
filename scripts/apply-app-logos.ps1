param(
  [ValidateSet('customer_app', 'provider_app', 'admin_app')]
  [string[]]$Apps = @('customer_app', 'provider_app', 'admin_app')
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$logoRoot = Join-Path $projectRoot 'play-store-assets\logos-2026-10-08'
Add-Type -AssemblyName System.Drawing

# Preserve the chosen artwork; these exports change only pixel dimensions.
function Export-LogoPng([System.Drawing.Image]$Image, [int]$Size, [string]$Path) {
  $bitmap = New-Object System.Drawing.Bitmap($Size, $Size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb))
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.DrawImage($Image, 0, 0, $Size, $Size)
    $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

$choices = @(
  @{ App = 'customer_app'; Source = (Join-Path $logoRoot 'customer-selected-master.png'); Export = 'customer-selected-512.png' },
  @{ App = 'provider_app'; Source = (Join-Path $logoRoot 'provider-selected-master.png'); Export = 'provider-selected-512.png' },
  @{ App = 'admin_app'; Source = (Join-Path $logoRoot 'admin-final-master.png'); Export = 'admin-final-512.png' }
)
$densities = @{ 'mdpi' = 48; 'hdpi' = 72; 'xhdpi' = 96; 'xxhdpi' = 144; 'xxxhdpi' = 192 }

foreach ($choice in ($choices | Where-Object { $_.App -in $Apps })) {
  $image = [System.Drawing.Image]::FromFile((Resolve-Path -LiteralPath $choice.Source).Path)
  try {
    Export-LogoPng $image 512 (Join-Path $logoRoot $choice.Export)
    $resRoot = Join-Path $projectRoot "apps\$($choice.App)\android\app\src\main\res"
    foreach ($density in $densities.Keys) {
      $icon = Join-Path $resRoot "mipmap-$density\ic_launcher.png"
      $backupDir = Join-Path $logoRoot "android-launcher-backup\$($choice.App)\mipmap-$density"
      New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
      $backup = Join-Path $backupDir 'ic_launcher.png'
      if ((Test-Path -LiteralPath $icon) -and -not (Test-Path -LiteralPath $backup)) {
        Copy-Item -LiteralPath $icon -Destination $backup
      }
      Export-LogoPng $image $densities[$density] $icon
    }
    Write-Host "Applied the selected logo to $($choice.App) Android launcher assets."
  } finally {
    $image.Dispose()
  }
}
