param(
    [string]$Source = (Join-Path $PSScriptRoot '../play-store-assets/quickmechanic-black-lime-master.png'),
    [string]$Destination = (Join-Path $PSScriptRoot '../play-store-assets/quickmechanic-black-lime-512.png')
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$original = [System.Drawing.Image]::FromFile((Resolve-Path -LiteralPath $Source).Path)
$bitmap = New-Object System.Drawing.Bitmap(512, 512, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb))
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
try {
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.DrawImage($original, 0, 0, 512, 512)
    $bitmap.Save($destination, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
    $graphics.Dispose()
    $bitmap.Dispose()
    $original.Dispose()
}
Get-Item -LiteralPath $destination | Select-Object FullName, Length
