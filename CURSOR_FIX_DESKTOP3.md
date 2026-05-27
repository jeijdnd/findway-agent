找到 Bat 语法报错位置，让 Cursor 修。

## Cursor 新对话，复制：

```
⚠️ 先 git pull

Bug：desktop.bat 双击报 "... was unexpected at this time."

诊断：第31行 curl 管道符或 errorlevel 检测在 cmd 中语法错误。

重写 desktop.bat，用简单方式等待后端：

@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo [INFO] Starting backend...
start "FindWay Backend" /MIN venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8765

echo [INFO] Waiting 5 seconds for backend...
timeout /t 5 /nobreak >nul

echo [INFO] Starting Electron...
start "" "node_modules\.bin\electron.cmd" .

echo Done. Backend: http://127.0.0.1:8765
pause
```

不要用 curl + goto + errorlevel 循环，直接用 fixed wait 5秒。
只改 desktop.bat。完成后 git push。
```

先不推 GitHub——在这边修完再一口气推。把上面内容贴给 Cursor。
