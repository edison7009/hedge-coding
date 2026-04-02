$ErrorActionPreference = "Stop"
$repo = "edison7009/hedge-coding"
$api = "https://api.github.com/repos/$repo/releases/latest"

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Hedge Coding - Auto Installer          " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "🚀 Fetching latest release..." -ForegroundColor Cyan

try {
    $release = Invoke-RestMethod -Uri $api
    $asset = $release.assets | Where-Object { $_.name -match "\.exe$" } | Select-Object -First 1

    if (-not $asset) {
        Write-Host "❌ Could not find the Windows installer (.exe) in the latest release." -ForegroundColor Red
        Write-Host "🚧 Please build from source or check back later." -ForegroundColor Yellow
        exit 1
    }

    $downloadUrl = $asset.browser_download_url
    $tempFile = "$env:TEMP\$($asset.name)"

    Write-Host "📦 Downloading (this may take a minute): $downloadUrl" -ForegroundColor Cyan
    Invoke-WebRequest -Uri $downloadUrl -OutFile $tempFile

    Write-Host "🔧 Installing in background (Silent Mode)..." -ForegroundColor Green
    # Add /S to run the NSIS installer silently
    Start-Process -FilePath $tempFile -ArgumentList "/S" -Wait

    Write-Host "✅ Installation complete! You can launch Hedge Coding from your start menu or desktop." -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to fetch the latest release. It may not be published yet." -ForegroundColor Red
    Write-Host "🚧 Please follow the 'Build from Source' instructions in the README for now." -ForegroundColor Yellow
    exit 1
}
