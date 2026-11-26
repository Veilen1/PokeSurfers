# Extracts the four power-up balls from the Pokemon Emerald Poke Balls sheet
# (assets/Sprites-Emerald/poke-balls.png, contributed by wormintheworks).
# The sheet stores each ball in a 16x16 cell; the visible art occupies the
# central 12x12. The green background is keyed to transparency.
#
# Run from the repository root: powershell -ExecutionPolicy Bypass -File scripts/extract-emerald-balls.ps1

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $root "assets\Sprites-Emerald\poke-balls.png"
$outputDir = Join-Path $root "frontend\public\game\ui"

if (-not (Test-Path $sourcePath)) {
  throw "Poké Balls sheet not found at $sourcePath"
}

$source = [System.Drawing.Bitmap]::FromFile($sourcePath)
$background = $source.GetPixel(0, 0)

$balls = @(
  @{ name = 'ball-poke'; x = 34 },
  @{ name = 'ball-great'; x = 50 },
  @{ name = 'ball-ultra'; x = 82 },
  @{ name = 'ball-master'; x = 98 }
)

foreach ($ball in $balls) {
  $crop = $source.Clone(
    (New-Object System.Drawing.Rectangle $ball.x, 2, 12, 12),
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
  )
  for ($y = 0; $y -lt 12; $y++) {
    for ($x = 0; $x -lt 12; $x++) {
      $pixel = $crop.GetPixel($x, $y)
      if (
        [math]::Abs($pixel.R - $background.R) -le 18 -and
        [math]::Abs($pixel.G - $background.G) -le 18 -and
        [math]::Abs($pixel.B - $background.B) -le 18
      ) {
        $crop.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, $pixel.R, $pixel.G, $pixel.B))
      }
    }
  }
  $crop.Save((Join-Path $outputDir "$($ball.name).png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $crop.Dispose()
  Write-Output "Wrote $(Join-Path $outputDir "$($ball.name).png")"
}

$source.Dispose()
