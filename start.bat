@echo off
chcp 65001 >nul
title M4S文件合并工具 - 启动器

echo ========================================
echo    M4S文件合并工具 - 快速启动
echo ========================================
echo.



echo.
echo 🚀 正在启动M4S文件合并工具...
echo.

:: 启动应用程序
call npm start

:: 如果程序异常退出，显示错误信息
if %errorlevel% neq 0 (
    echo.
    echo ❌ 程序启动失败，错误代码: %errorlevel%
    echo.
    echo 可能的解决方案:
    echo 1. 删除 node_modules 文件夹后重新运行此脚本
    echo 2. 确保Node.js版本为16.0.0或更高版本
    echo 3. 检查网络连接是否正常
    echo.
    pause
    exit /b 1
)

echo.
echo 程序已正常退出
pause