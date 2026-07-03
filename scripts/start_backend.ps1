# scripts/start_backend.ps1
# Starts the FastAPI backend with the virtual environment activated

$ErrorActionPreference = "Stop"

Write-Host "🧠 Starting EKA Backend..." -ForegroundColor Cyan

# Navigate to backend directory (assumes script is run from project root)
Set-Location "$PSScriptRoot\..\backend"

# Check venv exists
if (-not (Test-Path ".\venv\Scripts\Activate.ps1")) {
    Write-Host "❌ Virtual environment not found. Run:" -ForegroundColor Red
    Write-Host "   cd backend && python -m venv venv && .\venv\Scripts\Activate.ps1 && pip install -r requirements.txt"
    exit 1
}

# Activate virtual environment
& ".\venv\Scripts\Activate.ps1"

# Check .env exists
if (-not (Test-Path ".\.env")) {
    Write-Host "❌ .env file not found. Copy .env.example to .env and configure it." -ForegroundColor Red
    exit 1
}

# Check Ollama is running
try {
    $response = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -TimeoutSec 3
    Write-Host "✅ Ollama is running" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Ollama not detected. Start Ollama and pull qwen3:8b first." -ForegroundColor Yellow
}

# Start FastAPI
Write-Host "🚀 Starting FastAPI on http://localhost:8000" -ForegroundColor Green
Write-Host "📄 API docs: http://localhost:8000/api/docs" -ForegroundColor Blue
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
