# scripts/start_frontend.ps1
$ErrorActionPreference = "Stop"
Write-Host "🌐 Starting EKA Frontend..." -ForegroundColor Cyan
Set-Location "$PSScriptRoot\..\frontend"

if (-not (Test-Path ".\node_modules")) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
    npm install
}

Write-Host "🚀 Starting Vite dev server on http://localhost:5173" -ForegroundColor Green
npm run dev
