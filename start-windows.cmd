@echo off
cd /d "%~dp0"
set PORT=42831
node scripts/serve.mjs
pause
