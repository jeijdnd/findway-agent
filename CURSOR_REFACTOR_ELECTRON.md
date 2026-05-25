⚠️ 先 git pull

@PROGRESS_BOARD.md

重构：放弃 Electron 自动管理后端。改用可靠的两步启动。

## 问题

Electron 自己启动后端的逻辑修了 8 轮仍不稳定。但浏览器模式已验证可用：双击 run.bat → 打开 localhost:8765 → 一切正常。

## 方案

### 1. 重写 desktop.bat

```
@echo off
chcp 65001 >nul
cd /d "%~dp0"

:: Start backend
echo [INFO] Starting backend...
start "FindWay Backend" /MIN venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8765

:: Wait for backend
echo Waiting for backend...
:wait
timeout /t 2 >nul
curl -s http://127.0.0.1:8765/api/health >nul 2>&1
if %errorlevel% neq 0 goto wait

:: Start Electron (just loads localhost, no process management)
echo [INFO] Starting Electron...
start "" "node_modules\.bin\electron.cmd" .
```

### 2. 简化 electron/main.js

- 删除所有 Python 进程管理代码（startPythonBackend、waitForBackend、backedProcess、PYTHONPATH 等）
- 简化为：app.whenReady → createWindow → loadURL("http://127.0.0.1:8765")
- 保留窗口记忆、系统托盘等 UI 功能
- 保留基本的错误处理

### 结果

- desktop.bat 负责：启动后端 → 等待就绪 → 启动 Electron
- Electron 只负责：显示窗口，指向 localhost:8765
- 后端和前端分离管理，各管各的

## 约束
重写两个文件：desktop.bat + electron/main.js（极简化）。
electron/preload.js 不动。
