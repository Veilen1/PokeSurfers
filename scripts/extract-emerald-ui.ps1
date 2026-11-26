# Extracts the Emerald UI pieces used by the runner:
#   - panel-emerald.png       (menu box border for the pause/end cards)
#   - stat-arrow-*.png        (Atk / Def / Spd / Acc chevrons, background keyed)
#   - ghost-gastly/haunter    (Emerald battle sprites for Lavender Town)
#
# Run from the repository root:
#   powershell -ExecutionPolicy Bypass -File scripts/extract-emerald-ui.ps1

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$menuPath = Join-Path $root "assets\Sprites-Emerald\pokemon-menu.png"
$statsPath = Join-Path $root "assets\Sprites-Emerald\stat-effects.png"
$gen1Path = Join-Path $root "assets\Sprites-Emerald\pokemon-gen1.png"
$outputDir = Join-Path $root "frontend\public\game\ui"
$sourceOutput = Join-Path $root "assets\Sprites-Emerald\ui"

New-Item -ItemType Directory -Force -Path $outputDir, $sourceOutput | Out-Null

function Remove-CornerBackground {
  param(
    [System.Drawing.Bitmap]$Source,
    [int]$X,
    [int]$Y,
    [int]$Width,
    [int]$Height,
    [int]$Tolerance = 14,
    [ValidateSet('largest', 'significant', 'all')]
    [string]$Keep = 'significant',
    [switch]$Whole,
    [int]$PaletteCount = 1,
    [string[]]$ExtraColors = @()
  )

  $crop = $Source.Clone(
    (New-Object System.Drawing.Rectangle $X, $Y, $Width, $Height),
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
  )
  $bg = $crop.GetPixel(0, 0)
  $counts = @{}
  if ($Whole) {
    for ($py = 0; $py -lt $Height; $py++) {
      for ($px = 0; $px -lt $Width; $px++) {
        $p = $crop.GetPixel($px, $py)
        $key = "$($p.R),$($p.G),$($p.B)"
        if (-not $counts.ContainsKey($key)) { $counts[$key] = 0 }
        $counts[$key]++
      }
    }
  } else {
    for ($i = 0; $i -lt $Width; $i++) {
      foreach ($py in @(0, ($Height - 1))) {
        $p = $crop.GetPixel($i, $py)
        $key = "$($p.R),$($p.G),$($p.B)"
        if (-not $counts.ContainsKey($key)) { $counts[$key] = 0 }
        $counts[$key]++
      }
    }
    for ($i = 0; $i -lt $Height; $i++) {
      foreach ($px in @(0, ($Width - 1))) {
        $p = $crop.GetPixel($px, $i)
        $key = "$($p.R),$($p.G),$($p.B)"
        if (-not $counts.ContainsKey($key)) { $counts[$key] = 0 }
        $counts[$key]++
      }
    }
  }
  $bgEntries = $counts.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First $PaletteCount
  $bgColors = @()
  foreach ($entry in $bgEntries) {
    $parts = $entry.Name -split ','
    $bgColors += [System.Drawing.Color]::FromArgb(255, [int]$parts[0], [int]$parts[1], [int]$parts[2])
  }
  foreach ($extra in $ExtraColors) {
    $parts = $extra -split ','
    $bgColors += [System.Drawing.Color]::FromArgb(255, [int]$parts[0], [int]$parts[1], [int]$parts[2])
  }

  for ($py = 0; $py -lt $Height; $py++) {
    for ($px = 0; $px -lt $Width; $px++) {
      $p = $crop.GetPixel($px, $py)
      foreach ($bg in $bgColors) {
        if (
          [math]::Abs($p.R - $bg.R) -le $Tolerance -and
          [math]::Abs($p.G - $bg.G) -le $Tolerance -and
          [math]::Abs($p.B - $bg.B) -le $Tolerance
        ) {
          $crop.SetPixel($px, $py, [System.Drawing.Color]::FromArgb(0, $p.R, $p.G, $p.B))
          break
        }
      }
    }
  }

  # Remove detached dust from the sheet.
  $labels = New-Object 'int[,]' $Width, $Height
  $islands = New-Object System.Collections.Generic.List[object]
  for ($sy = 0; $sy -lt $Height; $sy++) {
    for ($sx = 0; $sx -lt $Width; $sx++) {
      if ($labels[$sx, $sy] -ne 0 -or $crop.GetPixel($sx, $sy).A -le 8) { continue }
      $queue = New-Object System.Collections.Generic.Queue[object]
      $queue.Enqueue(@($sx, $sy))
      $labels[$sx, $sy] = 1
      $pixels = New-Object System.Collections.Generic.List[object]
      while ($queue.Count -gt 0) {
        $point = $queue.Dequeue()
        $px = [int]$point[0]; $py = [int]$point[1]
        $pixels.Add(@($px, $py))
        foreach ($next in @(@(($px + 1), $py), @(($px - 1), $py), @($px, ($py + 1)), @($px, ($py - 1)))) {
          $nx = [int]$next[0]; $ny = [int]$next[1]
          if ($nx -lt 0 -or $ny -lt 0 -or $nx -ge $Width -or $ny -ge $Height) { continue }
          if ($labels[$nx, $ny] -ne 0) { continue }
          if ($crop.GetPixel($nx, $ny).A -le 8) { continue }
          $labels[$nx, $ny] = 1
          $queue.Enqueue(@($nx, $ny))
        }
      }
      $islands.Add([pscustomobject]@{ Pixels = $pixels; Area = $pixels.Count })
    }
  }
  if ($Keep -ne 'all' -and $islands.Count -gt 0) {
    $largest = ($islands | Sort-Object Area -Descending | Select-Object -First 1).Area
    $minArea = if ($Keep -eq 'largest') { $largest } else { [math]::Max(8, [math]::Floor($largest * 0.04)) }
    foreach ($island in $islands) {
      if ($island.Area -ge $minArea) { continue }
      foreach ($point in $island.Pixels) {
        $p = $crop.GetPixel($point[0], $point[1])
        $crop.SetPixel($point[0], $point[1], [System.Drawing.Color]::FromArgb(0, $p.R, $p.G, $p.B))
      }
    }
  }

  $minX = $Width; $minY = $Height; $maxX = -1; $maxY = -1
  for ($py = 0; $py -lt $Height; $py++) {
    for ($px = 0; $px -lt $Width; $px++) {
      if ($crop.GetPixel($px, $py).A -gt 8) {
        if ($px -lt $minX) { $minX = $px }
        if ($px -gt $maxX) { $maxX = $px }
        if ($py -lt $minY) { $minY = $py }
        if ($py -gt $maxY) { $maxY = $py }
      }
    }
  }
  if ($maxX -lt 0) { $crop.Dispose(); return $null }

  $outW = $maxX - $minX + 3
  $outH = $maxY - $minY + 3
  $trimmed = New-Object System.Drawing.Bitmap -ArgumentList $outW, $outH, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($trimmed)
  $graphics.DrawImage(
    $crop,
    (New-Object System.Drawing.Rectangle 1, 1, ($maxX - $minX + 1), ($maxY - $minY + 1)),
    (New-Object System.Drawing.Rectangle $minX, $minY, ($maxX - $minX + 1), ($maxY - $minY + 1)),
    [System.Drawing.GraphicsUnit]::Pixel
  )
  $graphics.Dispose()
  $crop.Dispose()
  return $trimmed
}

function Save-Ui {
  param([System.Drawing.Bitmap]$Image, [string]$Name)
  if ($null -eq $Image) { return }
  $Image.Save((Join-Path $sourceOutput "$Name.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $Image.Save((Join-Path $outputDir "$Name.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Output "$Name $($Image.Width)x$($Image.Height)"
  $Image.Dispose()
}

# Menu box border: the "Choose a POKeMON." text box in the party menu.
$menu = [System.Drawing.Bitmap]::FromFile($menuPath)
$panel = $menu.Clone((New-Object System.Drawing.Rectangle 9, 385, 182, 30), [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
for ($y = 0; $y -lt $panel.Height; $y++) {
  for ($x = 0; $x -lt $panel.Width; $x++) {
    $p = $panel.GetPixel($x, $y)
    $greenMenu = $p.G -gt 120 -and $p.G -gt ($p.R + 8) -and $p.B -lt 120
    $yellowMenu = $p.R -gt 240 -and $p.G -gt 205 -and $p.B -lt 175
    $inner = $x -ge 6 -and $x -lt ($panel.Width - 6) -and $y -ge 6 -and $y -lt ($panel.Height - 6)
    if ($greenMenu -or $yellowMenu -or $inner) {
      $panel.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, $p.R, $p.G, $p.B))
    }
  }
}
Save-Ui $panel 'panel-emerald'
$menu.Dispose()

# Stat-up chevrons. Backgrounds are solid squares; keep the coloured zigzags.
$stats = [System.Drawing.Bitmap]::FromFile($statsPath)
Save-Ui (Remove-CornerBackground -Source $stats -X 48 -Y 26 -Width 36 -Height 30 -Tolerance 100 -Keep significant -Whole -ExtraColors '255,223,128') 'stat-arrow-attack'
Save-Ui (Remove-CornerBackground -Source $stats -X 87 -Y 26 -Width 36 -Height 30 -Tolerance 100 -Keep significant -Whole -ExtraColors '255,223,128') 'stat-arrow-defense'
Save-Ui (Remove-CornerBackground -Source $stats -X 126 -Y 26 -Width 36 -Height 30 -Tolerance 100 -Keep significant -Whole -ExtraColors '255,223,128') 'stat-arrow-speed'
Save-Ui (Remove-CornerBackground -Source $stats -X 243 -Y 26 -Width 36 -Height 30 -Tolerance 80 -Keep significant -Whole -ExtraColors '255,223,128') 'stat-arrow-accuracy'
$stats.Dispose()

# Emerald Gastly and Haunter battle sprites. The sheet is a grid of 64x64
# cells separated by white gutters.
$gen1 = [System.Drawing.Bitmap]::FromFile($gen1Path)
Save-Ui (Remove-CornerBackground -Source $gen1 -X 143 -Y 1247 -Width 64 -Height 64 -Tolerance 14 -Keep significant) 'ghost-gastly'
Save-Ui (Remove-CornerBackground -Source $gen1 -X 282 -Y 1247 -Width 63 -Height 64 -Tolerance 14 -Keep significant) 'ghost-haunter'
$gen1.Dispose()

Write-Output "Done."
