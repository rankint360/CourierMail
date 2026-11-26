# Render the folded-Z artwork as maskable app icons on Windows.
# Geometry matches web/brand/mark.svg in a 512-unit coordinate space.
Add-Type -AssemblyName System.Drawing
$projectRoot = Split-Path $PSScriptRoot -Parent
$points = @(128,144,384,144,384,200,224,312,384,312,384,368,128,368,128,312,288,200,128,200)
foreach ($size in @(32,180,192,512)) {
    $bitmap = [Drawing.Bitmap]::new($size * 3, $size * 3)
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([Drawing.ColorTranslator]::FromHtml('#3159D8'))
    $scale = $size * 3 / 512
    $polygon = @()
    for ($index = 0; $index -lt $points.Count; $index += 2) {
        $polygon += [Drawing.PointF]::new($points[$index] * $scale, $points[$index + 1] * $scale)
    }
    $white = [Drawing.SolidBrush]::new([Drawing.Color]::White)
    $mint = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#C1EFDF'))
    $graphics.FillPolygon($white, [Drawing.PointF[]]$polygon)
    $graphics.FillPolygon($mint, [Drawing.PointF[]]@([Drawing.PointF]::new(320*$scale,312*$scale),[Drawing.PointF]::new(384*$scale,312*$scale),[Drawing.PointF]::new(384*$scale,368*$scale)))
    $output = [Drawing.Bitmap]::new($size,$size)
    $resizer = [Drawing.Graphics]::FromImage($output)
    $resizer.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $resizer.DrawImage($bitmap,0,0,$size,$size)
    $fileName = if ($size -eq 32) { 'favicon-32.png' } elseif ($size -eq 180) { 'apple-touch-icon.png' } else { "icon-$size.png" }
    $output.Save((Join-Path $projectRoot "web/$fileName"),[Drawing.Imaging.ImageFormat]::Png)
    $resizer.Dispose(); $output.Dispose(); $mint.Dispose(); $white.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}

$png = [IO.File]::ReadAllBytes((Join-Path $projectRoot 'web/favicon-32.png'))
$iconStream = [IO.File]::Create((Join-Path $projectRoot 'web/favicon.ico'))
$writer = [IO.BinaryWriter]::new($iconStream)
$writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]1)
$writer.Write([byte]32); $writer.Write([byte]32); $writer.Write([byte]0); $writer.Write([byte]0)
$writer.Write([uint16]1); $writer.Write([uint16]32); $writer.Write([uint32]$png.Length); $writer.Write([uint32]22)
$writer.Write($png); $writer.Dispose(); $iconStream.Dispose()

# Outline the wordmark so SVG exports do not depend on installed fonts.
$lettering = [Drawing.Drawing2D.GraphicsPath]::new()
$fontFamily = [Drawing.FontFamily]::new('Arial')
$lettering.AddString('Zavrill', $fontFamily, [int][Drawing.FontStyle]::Bold, 49, [Drawing.PointF]::new(0,0), [Drawing.StringFormat]::GenericTypographic)
$bounds = $lettering.GetBounds()
$matrix = [Drawing.Drawing2D.Matrix]::new()
$matrix.Translate(-$bounds.X,-$bounds.Y)
$lettering.Transform($matrix)
$matrix.Reset()
$letterScale = 44 / $bounds.Height
$matrix.Scale($letterScale,$letterScale)
$lettering.Transform($matrix)
$matrix.Reset(); $matrix.Translate(90,14); $lettering.Transform($matrix)
$coords = $lettering.PathPoints; $types = $lettering.PathTypes
$segments = [Collections.Generic.List[string]]::new()
function Number([single]$value) { $value.ToString('0.###',[Globalization.CultureInfo]::InvariantCulture) }
for ($index = 0; $index -lt $coords.Length; $index++) {
    $type = $types[$index] -band 7
    if ($type -eq 0) { $segments.Add("M$(Number $coords[$index].X) $(Number $coords[$index].Y)") }
    elseif ($type -eq 1) { $segments.Add("L$(Number $coords[$index].X) $(Number $coords[$index].Y)") }
    elseif ($type -eq 3) {
        $segments.Add("C$(Number $coords[$index].X) $(Number $coords[$index].Y) $(Number $coords[$index+1].X) $(Number $coords[$index+1].Y) $(Number $coords[$index+2].X) $(Number $coords[$index+2].Y)")
        $index += 2
    }
    if ($types[$index] -band 128) { $segments.Add('Z') }
}
$width = [Math]::Ceiling($bounds.Width * $letterScale + 94)
$mark = [IO.File]::ReadAllText((Join-Path $projectRoot 'web/brand/mark.svg')).Replace('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">','<svg width="72" height="72" viewBox="0 0 512 512">')
foreach ($variant in @(@('wordmark','#172B46'),@('wordmark-inverse','#FFFFFF'))) {
    $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+$width+' 72" role="img" aria-label="Zavrill">'+$mark+'<path fill="'+$variant[1]+'" d="'+($segments -join ' ')+'"/></svg>'
    [IO.File]::WriteAllText((Join-Path $projectRoot ('web/brand/'+$variant[0]+'.svg')),$svg,[Text.UTF8Encoding]::new($false))
}
$matrix.Dispose(); $lettering.Dispose(); $fontFamily.Dispose()
