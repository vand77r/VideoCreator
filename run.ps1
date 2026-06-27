# ReelsFlow Launcher Script
# Restores machine and user paths to ensure node and ffmpeg are globally recognized in the child shells.

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "        REELSFLOW VIDEO BULK CREATOR          " -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan

Write-Host "Spawning Express backend server in a new window..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:Path = '$env:Path'; npm.cmd start" -WorkingDirectory "$PSScriptRoot\server"

Write-Host "Spawning React Vite frontend in a new window..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:Path = '$env:Path'; npm.cmd run dev" -WorkingDirectory "$PSScriptRoot\client"

Write-Host "-----------------------------------------------" -ForegroundColor Green
Write-Host "Server: http://localhost:5000" -ForegroundColor Green
Write-Host "Client: Watch the second window for your dev URL (typically http://localhost:5173)" -ForegroundColor Green
Write-Host "-----------------------------------------------" -ForegroundColor Green
Write-Host "Press Ctrl+C in the generated windows to stop the services." -ForegroundColor Cyan
