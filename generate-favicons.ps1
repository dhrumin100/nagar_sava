# PowerShell script to generate favicon files from SVG
# This script requires ImageMagick or similar tool to convert SVG to ICO/PNG

Write-Host "🎨 Generating favicon files for NagarSewa..." -ForegroundColor Green

# Check if we're in the correct directory
if (-not (Test-Path "public/favicon.svg")) {
    Write-Host "❌ Error: favicon.svg not found in public/ directory" -ForegroundColor Red
    Write-Host "Please run this script from the project root directory" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Found favicon.svg" -ForegroundColor Green

# Create different sizes for better compatibility
$sizes = @(16, 32, 48, 64, 128, 256)

Write-Host "📝 Instructions for generating additional favicon formats:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Install ImageMagick: https://imagemagick.org/script/download.php#windows" -ForegroundColor Cyan
Write-Host "2. Or use an online converter like:" -ForegroundColor Cyan
Write-Host "   - https://favicon.io/favicon-converter/" -ForegroundColor Blue
Write-Host "   - https://convertio.co/svg-ico/" -ForegroundColor Blue
Write-Host ""

Write-Host "3. Convert the SVG to these formats:" -ForegroundColor Cyan
foreach ($size in $sizes) {
    Write-Host "   - favicon-${size}x${size}.png" -ForegroundColor White
}
Write-Host "   - favicon.ico (multi-size ICO file)" -ForegroundColor White
Write-Host ""

Write-Host "4. Place all files in the public/ directory" -ForegroundColor Cyan
Write-Host ""

Write-Host "🔧 If you have ImageMagick installed, uncomment and run these commands:" -ForegroundColor Yellow
Write-Host ""

# Commented ImageMagick commands (user can uncomment if they have it installed)
Write-Host "# Generate PNG files" -ForegroundColor Gray
foreach ($size in $sizes) {
    Write-Host "# magick public/favicon.svg -resize ${size}x${size} public/favicon-${size}x${size}.png" -ForegroundColor Gray
}
Write-Host ""
Write-Host "# Generate ICO file" -ForegroundColor Gray
Write-Host "# magick public/favicon-16x16.png public/favicon-32x32.png public/favicon-48x48.png public/favicon.ico" -ForegroundColor Gray

Write-Host ""
Write-Host "🌐 Don't forget to update your HTML <head> section with:" -ForegroundColor Green
Write-Host '<link rel="icon" type="image/svg+xml" href="/favicon.svg">' -ForegroundColor White
Write-Host '<link rel="icon" type="image/png" href="/favicon-32x32.png">' -ForegroundColor White
Write-Host '<link rel="icon" type="image/png" href="/favicon-16x16.png">' -ForegroundColor White
Write-Host '<link rel="shortcut icon" href="/favicon.ico">' -ForegroundColor White
