# Fix Dependencies Script for Windows PowerShell
# This script will clean and reinstall dependencies to resolve version conflicts

Write-Host "🔧 Fixing dependency conflicts..." -ForegroundColor Yellow

# Remove existing node_modules and lock files
Write-Host "🗑️  Cleaning existing dependencies..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Remove-Item -Recurse -Force "node_modules"
    Write-Host "✅ Removed node_modules" -ForegroundColor Green
}

if (Test-Path "package-lock.json") {
    Remove-Item "package-lock.json"
    Write-Host "✅ Removed package-lock.json" -ForegroundColor Green
}

# Clear npm cache
Write-Host "🧹 Clearing npm cache..." -ForegroundColor Yellow
npm cache clean --force

# Install dependencies with legacy peer deps
Write-Host "📦 Installing dependencies with legacy peer deps..." -ForegroundColor Yellow
npm install --legacy-peer-deps

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Dependencies installed successfully!" -ForegroundColor Green
    
    # Test build
    Write-Host "🔨 Testing build..." -ForegroundColor Yellow
    npm run build
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Build successful! Ready to deploy." -ForegroundColor Green
    } else {
        Write-Host "❌ Build failed. Check the error messages above." -ForegroundColor Red
    }
} else {
    Write-Host "❌ Dependency installation failed" -ForegroundColor Red
}

Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
