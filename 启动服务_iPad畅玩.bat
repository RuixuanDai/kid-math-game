@echo off
chcp 65001 >nul
title 🦁 童趣数学小王国 - iPad 局域网服务
cd /d "%~dp0"

echo ==============================================================
echo   🦁 童趣数学小王国 · iPad 局域网服务启动中...
echo ==============================================================
echo.

python server.py

if %ERRORLEVEL% NEQ 0 (
    echo Python 启动受阻，尝试使用 Node.js 启动...
    node server.js
)

pause
