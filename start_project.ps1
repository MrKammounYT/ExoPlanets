# Launch TASA Website and FastAPI Backend
Write-Host "Starting TASA FastAPI Backend on http://127.0.0.1:8000..." -ForegroundColor Cyan
Start-Process -FilePath "py" -ArgumentList "-m uvicorn main:app --host 127.0.0.1 --port 8000 --reload" -WorkingDirectory "$PSScriptRoot\tasa-project\backend"

Start-Sleep -Seconds 2

Write-Host "Starting TASA Vite Frontend on http://localhost:5173..." -ForegroundColor Green
Start-Process -FilePath "npm.cmd" -ArgumentList "run dev" -WorkingDirectory "$PSScriptRoot\tasa-project\site"

Write-Host "`nBoth services launched!" -ForegroundColor Yellow
Write-Host "  - Frontend: http://localhost:5173"
Write-Host "  - API Docs: http://127.0.0.1:8000/docs"
