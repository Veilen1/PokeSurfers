# Builds the Emerald building/prop set used by the runner.
#
# Sources:
#   assets/Sprites-Emerald/map-objects.png    (clean house/lab sprites by Lance)
#   assets/Sprites-Emerald/pokemon-center-mart.png (complete Center/Mart icons)
#   assets/Sprites-Emerald/littleroot-town.png (trees, flowers, mailbox)
#   assets/Sprites-Emerald/exterior-tileset.png (dirt path tile)
#   assets/Sprites-Emerald/object-cuttable-tree.png / object-breakable-rock.png
#                                                 (intact event frames from pret/pokeemerald)
#
# Output:
#   assets/Sprites-Emerald/buildings/*.png      (source-size building candidates)
#   assets/Sprites-Emerald/ui/obstacle-*.png    (complete cut-tree/rock obstacles)
#   frontend/public/game/buildings/*.png        (runtime assets)
#
# Run from the repository root:
#   powershell -ExecutionPolicy Bypass -File scripts/extract-emerald-buildings.ps1

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$mapObjectsPath = Join-Path $root "assets\Sprites-Emerald\map-objects.png"
$centerMartPath = Join-Path $root "assets\Sprites-Emerald\pokemon-center-mart.png"
$littlerootPath = Join-Path $root "assets\Sprites-Emerald\littleroot-town.png"
$tilesetPath = Join-Path $root "assets\Sprites-Emerald\exterior-tileset.png"
$cutTreeObjectPath = Join-Path $root "assets\Sprites-Emerald\object-cuttable-tree.png"
$breakableRockObjectPath = Join-Path $root "assets\Sprites-Emerald\object-breakable-rock.png"
$sourceOutput = Join-Path $root "assets\Sprites-Emerald\buildings"
$sourceUi = Join-Path $root "assets\Sprites-Emerald\ui"
$runtimeBuildings = Join-Path $root "frontend\public\game\buildings"
$runtimeUi = Join-Path $root "frontend\public\game\ui"

New-Item -ItemType Directory -Force -Path $sourceOutput, $sourceUi, $runtimeBuildings, $runtimeUi | Out-Null

# Remove the superseded clipped obstacle sprite so running the generator cannot
# leave it behind as a stale runtime option.
Remove-Item (Join-Path $runtimeUi 'veg-bush.png'), (Join-Path $sourceUi 'veg-bush.png') -Force -ErrorAction SilentlyContinue

function Get-BackgroundPalette {
  param([System.Drawing.Bitmap]$Image, [string]$Mode)
  $counts = @{}
  $w = $Image.Width; $h = $Image.Height
  for ($x = 0; $x -lt $w; $x++) {
    foreach ($y in @(0, ($h - 1))) {
      $p = $Image.GetPixel($x, $y)
      $key = "$($p.R),$($p.G),$($p.B)"
      if (-not $counts.ContainsKey($key)) { $counts[$key] = 0 }
      $counts[$key]++
    }
  }
  for ($y = 0; $y -lt $h; $y++) {
    foreach ($x in @(0, ($w - 1))) {
      $p = $Image.GetPixel($x, $y)
      $key = "$($p.R),$($p.G),$($p.B)"
      if (-not $counts.ContainsKey($key)) { $counts[$key] = 0 }
      $counts[$key]++
    }
  }

  $colors = $counts.GetEnumerator() | Sort-Object Value -Descending | ForEach-Object {
    $parts = $_.Name -split ','
    [pscustomobject]@{ R = [int]$parts[0]; G = [int]$parts[1]; B = [int]$parts[2]; Count = $_.Value }
  }

  if ($Mode -eq 'grass') {
    # Keep the teal grass shades and drop unrelated border colours (flowers, signs).
    return $colors | Where-Object { $_.G -gt 110 -and $_.G -gt ($_.R + 18) -and $_.G -gt ($_.B + 8) } | Select-Object -First 5
  }
  if ($Mode -eq 'border') {
    return $colors | Select-Object -First 4
  }
  return $colors | Select-Object -First 1
}

function Remove-Background {
  param(
    [System.Drawing.Bitmap]$Source,
    [int]$X,
    [int]$Y,
    [int]$Width,
    [int]$Height,
    [ValidateSet('white', 'grass', 'border', 'flood', 'whiteflood')]
    [string]$Mode = 'white',
    [ValidateSet('largest', 'significant', 'all')]
    [string]$Keep = 'significant'
  )

  $crop = $Source.Clone(
    (New-Object System.Drawing.Rectangle $X, $Y, $Width, $Height),
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
  )
  $palette = @(Get-BackgroundPalette -Image $crop -Mode $Mode)
  if ($palette.Count -eq 0) {
    $crop.Dispose()
    throw "No background palette found for crop $X,$Y ${Width}x${Height}."
  }

  $tolerance = if ($Mode -eq 'grass') { 20 } elseif ($Mode -eq 'whiteflood') { 14 } else { 18 }
  if ($Mode -eq 'flood' -or $Mode -eq 'whiteflood') {
    $bg = if ($Mode -eq 'whiteflood') { [System.Drawing.Color]::FromArgb(255, 255, 255, 255) } else { $palette[0] }
    $visited = New-Object 'bool[,]' $Width, $Height
    $queue = New-Object System.Collections.Generic.Queue[object]
    for ($px = 0; $px -lt $Width; $px++) {
      $queue.Enqueue(@($px, 0))
      $queue.Enqueue(@($px, ($Height - 1)))
    }
    for ($py = 0; $py -lt $Height; $py++) {
      $queue.Enqueue(@(0, $py))
      $queue.Enqueue(@(($Width - 1), $py))
    }
    while ($queue.Count -gt 0) {
      $point = $queue.Dequeue()
      $px = [int]$point[0]; $py = [int]$point[1]
      if ($px -lt 0 -or $py -lt 0 -or $px -ge $Width -or $py -ge $Height) { continue }
      if ($visited[$px, $py]) { continue }
      $visited[$px, $py] = $true
      $pixel = $crop.GetPixel($px, $py)
      if (
        [math]::Abs($pixel.R - $bg.R) -gt $tolerance -or
        [math]::Abs($pixel.G - $bg.G) -gt $tolerance -or
        [math]::Abs($pixel.B - $bg.B) -gt $tolerance
      ) { continue }
      $crop.SetPixel($px, $py, [System.Drawing.Color]::FromArgb(0, $pixel.R, $pixel.G, $pixel.B))
      $queue.Enqueue(@(($px + 1), $py))
      $queue.Enqueue(@(($px - 1), $py))
      $queue.Enqueue(@($px, ($py + 1)))
      $queue.Enqueue(@($px, ($py - 1)))
    }
  } else {
    for ($py = 0; $py -lt $Height; $py++) {
      for ($px = 0; $px -lt $Width; $px++) {
        $pixel = $crop.GetPixel($px, $py)
        foreach ($bg in $palette) {
          if (
            [math]::Abs($pixel.R - $bg.R) -le $tolerance -and
            [math]::Abs($pixel.G - $bg.G) -le $tolerance -and
            [math]::Abs($pixel.B - $bg.B) -le $tolerance
          ) {
            $crop.SetPixel($px, $py, [System.Drawing.Color]::FromArgb(0, $pixel.R, $pixel.G, $pixel.B))
            break
          }
        }
      }
    }
  }

  # Soften the anti-aliased halo around the removed background.
  $halo = if ($Mode -eq 'grass') { 32 } else { 28 }
  for ($py = 1; $py -lt ($Height - 1); $py++) {
    for ($px = 1; $px -lt ($Width - 1); $px++) {
      if ($crop.GetPixel($px, $py).A -eq 0) { continue }
      $nearTransparent = $crop.GetPixel($px - 1, $py).A -eq 0 -or $crop.GetPixel($px + 1, $py).A -eq 0 -or $crop.GetPixel($px, $py - 1).A -eq 0 -or $crop.GetPixel($px, $py + 1).A -eq 0
      if (-not $nearTransparent) { continue }
      $pixel = $crop.GetPixel($px, $py)
      foreach ($bg in $palette) {
        if (
          [math]::Abs($pixel.R - $bg.R) -le $halo -and
          [math]::Abs($pixel.G - $bg.G) -le $halo -and
          [math]::Abs($pixel.B - $bg.B) -le $halo
        ) {
          $crop.SetPixel($px, $py, [System.Drawing.Color]::FromArgb(0, $pixel.R, $pixel.G, $pixel.B))
          break
        }
      }
    }
  }

  # Drop detached slivers from neighbouring sprites. Buildings keep only the
  # largest island; props keep every island of a meaningful size.
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
  if ($islands.Count -gt 0) {
    $largest = ($islands | Sort-Object Area -Descending | Select-Object -First 1).Area
    $minArea = if ($Mode -eq 'white' -and $Keep -eq 'largest') { $largest } else { [math]::Max(12, [math]::Floor($largest * 0.06)) }
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

function Save-Sprite {
  param([System.Drawing.Bitmap]$Image, [string]$Name)
  if ($null -eq $Image) { return }
  $Image.Save((Join-Path $sourceOutput "$Name.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $Image.Save((Join-Path $runtimeBuildings "$Name.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Output "$Name $($Image.Width)x$($Image.Height)"
  $Image.Dispose()
}

function Save-UiSprite {
  param([System.Drawing.Bitmap]$Image, [string]$Name)
  if ($null -eq $Image) { return }
  $Image.Save((Join-Path $sourceUi "$Name.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $Image.Save((Join-Path $runtimeUi "$Name.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Output "$Name $($Image.Width)x$($Image.Height)"
  $Image.Dispose()
}

function Convert-RgbToHsl {
  param([double]$R, [double]$G, [double]$B)
  $r = $R / 255.0; $g = $G / 255.0; $b = $B / 255.0
  $max = [math]::Max($r, [math]::Max($g, $b))
  $min = [math]::Min($r, [math]::Min($g, $b))
  $l = ($max + $min) / 2.0
  if ($max -eq $min) { return @(0.0, 0.0, $l) }
  $d = $max - $min
  $s = if ($l -gt 0.5) { $d / (2.0 - $max - $min) } else { $d / ($max + $min) }
  if ($max -eq $r) { $h = (($g - $b) / $d + $(if ($g -lt $b) { 6 } else { 0 })) / 6.0 }
  elseif ($max -eq $g) { $h = (($b - $r) / $d + 2.0) / 6.0 }
  else { $h = (($r - $g) / $d + 4.0) / 6.0 }
  return @($h, $s, $l)
}

function Convert-HslToRgb {
  param([double]$H, [double]$S, [double]$L)
  if ($S -eq 0) { $v = [int][math]::Round($L * 255); return @($v, $v, $v) }
  $q = if ($L -lt 0.5) { $L * (1.0 + $S) } else { $L + $S - $L * $S }
  $p = 2.0 * $L - $q
  $hueToRgb = {
    param($p, $q, $t)
    if ($t -lt 0) { $t += 1 }
    if ($t -gt 1) { $t -= 1 }
    if ($t -lt (1.0 / 6.0)) { return $p + ($q - $p) * 6.0 * $t }
    if ($t -lt 0.5) { return $q }
    if ($t -lt (2.0 / 3.0)) { return $p + ($q - $p) * ((2.0 / 3.0) - $t) * 6.0 }
    return $p
  }
  $r = & $hueToRgb $p $q ($H + (1.0 / 3.0))
  $g = & $hueToRgb $p $q $H
  $b = & $hueToRgb $p $q ($H - (1.0 / 3.0))
  return @([int][math]::Round($r * 255), [int][math]::Round($g * 255), [int][math]::Round($b * 255))
}

function New-RecoloredSprite {
  param(
    [string]$SourcePath,
    [string]$Name,
    [double]$SourceHueStart = 0,
    [double]$SourceHueEnd = 360,
    [double]$TargetHue = -1,
    [double]$SaturationScale = 1,
    [double]$MinSaturation = 0.2,
    [double]$TintR = -1,
    [double]$TintG = 0,
    [double]$TintB = 0,
    [double]$TintAmount = 0
  )

  $source = [System.Drawing.Bitmap]::FromFile($SourcePath)
  $out = New-Object System.Drawing.Bitmap -ArgumentList $source.Width, $source.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  for ($y = 0; $y -lt $source.Height; $y++) {
    for ($x = 0; $x -lt $source.Width; $x++) {
      $p = $source.GetPixel($x, $y)
      if ($p.A -eq 0) { continue }
      $hsl = Convert-RgbToHsl $p.R $p.G $p.B
      $h = $hsl[0] * 360.0; $s = $hsl[1]; $l = $hsl[2]
      $inHueRange = if ($SourceHueStart -le $SourceHueEnd) { $h -ge $SourceHueStart -and $h -le $SourceHueEnd } else { $h -ge $SourceHueStart -or $h -le $SourceHueEnd }
      if ($TargetHue -ge 0 -and $s -ge $MinSaturation -and $inHueRange) { $h = $TargetHue }
      $s = [math]::Min(1.0, [math]::Max(0.0, $s * $SaturationScale))
      $rgb = Convert-HslToRgb ($h / 360.0) $s $l
      $r = $rgb[0]; $g = $rgb[1]; $b = $rgb[2]
      if ($TintAmount -gt 0 -and $TintR -ge 0) {
        $r = [int][math]::Round($r * (1 - $TintAmount) + $TintR * $TintAmount)
        $g = [int][math]::Round($g * (1 - $TintAmount) + $TintG * $TintAmount)
        $b = [int][math]::Round($b * (1 - $TintAmount) + $TintB * $TintAmount)
      }
      $out.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($p.A, $r, $g, $b))
    }
  }
  $source.Dispose()
  return $out
}

function New-SignSprite {
  $width = 26
  $height = 34
  $bitmap = New-Object System.Drawing.Bitmap -ArgumentList $width, $height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $dark = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 58, 63, 87))
  $wood = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 151, 101, 55))
  $light = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 201, 168, 107))
  $green = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 63, 122, 58))
  $red = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 208, 72, 64))
  $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 248, 248, 240))

  # Post.
  $graphics.FillRectangle($dark, 11, 17, 4, 17)
  $graphics.FillRectangle($wood, 12, 18, 2, 15)

  # Board with a green header and a simple Poke Ball stamp.
  $graphics.FillRectangle($dark, 2, 3, 22, 16)
  $graphics.FillRectangle($light, 3, 4, 20, 14)
  $graphics.FillRectangle($green, 3, 4, 20, 4)
  $graphics.FillRectangle($dark, 10, 10, 6, 6)
  $graphics.FillRectangle($red, 11, 11, 4, 2)
  $graphics.FillRectangle($white, 11, 13, 4, 2)
  $graphics.FillRectangle($dark, 11, 12, 4, 1)

  $graphics.Dispose()
  $dark.Dispose(); $wood.Dispose(); $light.Dispose(); $green.Dispose(); $red.Dispose(); $white.Dispose()
  return $bitmap
}

# --- Clean building sprites from the Map Objects sheet ---
$mapObjects = [System.Drawing.Bitmap]::FromFile($mapObjectsPath)
Save-Sprite (Remove-Background -Source $mapObjects -X 172 -Y 72 -Width 62 -Height 68 -Mode whiteflood -Keep largest) 'house-green-b'
Save-Sprite (Remove-Background -Source $mapObjects -X 249 -Y 72 -Width 66 -Height 68 -Mode whiteflood -Keep largest) 'house-purple'
Save-Sprite (Remove-Background -Source $mapObjects -X 328 -Y 72 -Width 66 -Height 68 -Mode whiteflood -Keep largest) 'house-red'
Save-Sprite (Remove-Background -Source $mapObjects -X 150 -Y 149 -Width 112 -Height 88 -Mode whiteflood -Keep largest) 'oak-lab'
Save-UiSprite (Remove-Background -Source $mapObjects -X 350 -Y 32 -Width 36 -Height 38 -Mode whiteflood -Keep largest) 'veg-pine-large'
Save-UiSprite (Remove-Background -Source $mapObjects -X 331 -Y 37 -Width 20 -Height 32 -Mode whiteflood -Keep largest) 'veg-pine-small'
$mapObjects.Dispose()

# The intact first frame from each Emerald event-object sheet. The remaining
# three cells are the cut/break animation and are deliberately not used as
# static obstacles.
$cutTreeSheet = [System.Drawing.Bitmap]::FromFile($cutTreeObjectPath)
Save-UiSprite (Remove-Background -Source $cutTreeSheet -X 0 -Y 0 -Width 16 -Height 16 -Mode flood -Keep all) 'obstacle-tree'
$cutTreeSheet.Dispose()
$rockSheet = [System.Drawing.Bitmap]::FromFile($breakableRockObjectPath)
Save-UiSprite (Remove-Background -Source $rockSheet -X 0 -Y 0 -Width 16 -Height 16 -Mode flood -Keep all) 'obstacle-rock'
$rockSheet.Dispose()

# --- Complete Center and Mart icons from the dedicated location sheet ---
$centerMart = [System.Drawing.Bitmap]::FromFile($centerMartPath)
Save-Sprite (Remove-Background -Source $centerMart -X 386 -Y 476 -Width 76 -Height 68 -Mode flood -Keep largest) 'pokemon-center'
Save-Sprite (Remove-Background -Source $centerMart -X 481 -Y 476 -Width 67 -Height 68 -Mode flood -Keep largest) 'pokemart'
$centerMart.Dispose()

# --- Route sign built from the Emerald palette ---
Save-Sprite (New-SignSprite) 'sign'

# --- Flowers, mailbox and tiles from the Littleroot map ---
$littleroot = [System.Drawing.Bitmap]::FromFile($littlerootPath)
Save-UiSprite (Remove-Background -Source $littleroot -X 92 -Y 172 -Width 22 -Height 20 -Mode grass -Keep significant) 'veg-flowers'
Save-Sprite (Remove-Background -Source $littleroot -X 208 -Y 168 -Width 26 -Height 32 -Mode grass -Keep all) 'mailbox'
$grassTile = $littleroot.Clone((New-Object System.Drawing.Rectangle 240, 80, 16, 16), $littleroot.PixelFormat)
Save-UiSprite $grassTile 'tile-grass'
$littleroot.Dispose()

# --- Dirt path tile from the exterior tileset ---
$tileset = [System.Drawing.Bitmap]::FromFile($tilesetPath)
$pathTile = $tileset.Clone((New-Object System.Drawing.Rectangle 896, 336, 16, 16), $tileset.PixelFormat)
Save-UiSprite $pathTile 'tile-path'
$tileset.Dispose()

# --- Colour variants for the remaining house slots ---
Save-Sprite (New-RecoloredSprite -SourcePath (Join-Path $runtimeBuildings 'house-red.png') -Name 'house-green-a' -SourceHueStart 330 -SourceHueEnd 45 -TargetHue 120 -MinSaturation 0.32) 'house-green-a'
Save-Sprite (New-RecoloredSprite -SourcePath (Join-Path $runtimeBuildings 'house-red.png') -Name 'house-blue' -SourceHueStart 330 -SourceHueEnd 45 -TargetHue 212 -MinSaturation 0.32) 'house-blue'
Save-Sprite (New-RecoloredSprite -SourcePath (Join-Path $runtimeBuildings 'house-red.png') -Name 'house-lime' -SourceHueStart 330 -SourceHueEnd 45 -TargetHue 78 -MinSaturation 0.32) 'house-lime'
Save-Sprite (New-RecoloredSprite -SourcePath (Join-Path $runtimeBuildings 'house-red.png') -Name 'house-gray' -SaturationScale 0.12) 'house-gray'
Save-Sprite (New-RecoloredSprite -SourcePath (Join-Path $runtimeBuildings 'house-red.png') -Name 'house-yellow' -SourceHueStart 330 -SourceHueEnd 45 -TargetHue 46 -MinSaturation 0.32) 'house-yellow'

# --- Civic building variants built from the Emerald lab/shop ---
Save-Sprite (New-RecoloredSprite -SourcePath (Join-Path $runtimeBuildings 'oak-lab.png') -Name 'pokemon-gym' -TintR 88 -TintG 146 -TintB 196 -TintAmount 0.18) 'pokemon-gym'
Save-Sprite (New-RecoloredSprite -SourcePath (Join-Path $runtimeBuildings 'oak-lab.png') -Name 'museum' -TintR 206 -TintG 190 -TintB 150 -TintAmount 0.16) 'museum'
Save-Sprite (New-RecoloredSprite -SourcePath (Join-Path $runtimeBuildings 'pokemart.png') -Name 'bike-shop' -TintR 80 -TintG 188 -TintB 208 -TintAmount 0.18) 'bike-shop'
Save-Sprite (New-RecoloredSprite -SourcePath (Join-Path $runtimeBuildings 'house-purple.png') -Name 'fan-club' -TintR 236 -TintG 180 -TintB 96 -TintAmount 0.12) 'fan-club'
Save-Sprite (New-RecoloredSprite -SourcePath (Join-Path $runtimeBuildings 'oak-lab.png') -Name 'celadon-store' -TintR 236 -TintG 202 -TintB 110 -TintAmount 0.2) 'celadon-store'
Save-Sprite (New-RecoloredSprite -SourcePath (Join-Path $runtimeBuildings 'oak-lab.png') -Name 'celadon-mansion' -TintR 188 -TintG 134 -TintB 154 -TintAmount 0.18) 'celadon-mansion'
Save-Sprite (New-RecoloredSprite -SourcePath (Join-Path $runtimeBuildings 'pokemart.png') -Name 'game-corner' -TintR 220 -TintG 92 -TintB 188 -TintAmount 0.2) 'game-corner'
Save-Sprite (New-RecoloredSprite -SourcePath (Join-Path $runtimeBuildings 'oak-lab.png') -Name 'pokemon-tower' -TintR 142 -TintG 112 -TintB 186 -TintAmount 0.24) 'pokemon-tower'

Write-Output "Done."
