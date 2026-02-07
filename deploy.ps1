# Netlify Deployment Script for Windows PowerShell
# Make sure you have Netlify CLI installed: npm install -g netlify-cli

Write-Host "🚀 Starting Netlify deployment..." -ForegroundColor Green

# Check if Netlify CLI is installed
try {
    netlify --version | Out-Null
    Write-Host "✅ Netlify CLI found" -ForegroundColor Green
} catch {
    Write-Host "❌ Netlify CLI not found. Installing..." -ForegroundColor Red
    npm install -g netlify-cli
}

# Build the project
Write-Host "📦 Building project..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Build successful" -ForegroundColor Green
    
    # Deploy to Netlify
    Write-Host "🌐 Deploying to Netlify..." -ForegroundColor Yellow
    netlify deploy --prod --dir=dist
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "🎉 Deployment successful!" -ForegroundColor Green
    } else {
        Write-Host "❌ Deployment failed" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Build failed" -ForegroundColor Red
}

Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
