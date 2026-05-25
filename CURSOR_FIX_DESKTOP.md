⚠️ 先 git pull

@PROGRESS_BOARD.md

Bug修复：desktop.bat 双击打不开。问题定位如下：

## 问题分析（3个Bug）

### Bug 1：闪退无提示
第26行 `call npx electron .` 结束后窗口直接关闭，如果出错看不到任何信息。
**修复**：在最后加 `pause`

### Bug 2：npm install 卡住或被误关
`call npm install` 下载 electron（~100MB）可能很久，用户以为卡死关掉了窗口。
**修复**：加超时提示文字"正在下载Electron（首次约3分钟），请勿关闭此窗口..."

### Bug 3：npx 可能不在 PATH 或 electron 命令找不到
某些系统中 `npx electron .` 需要改成 `node_modules\.bin\electron.cmd .`
**修复**：改用绝对路径调用，并加错误检查

## 修复指令

重写 signage-app\desktop.bat：

```
@echo off
title FindWay Agent - Desktop

cd /d "%~dp0"

:: Step 1: Check frontend build
if not exist "frontend\dist\index.html" (
    echo [INFO] Building frontend (first time)...
    cd frontend
    call npm install
    call npm run build
    cd ..
)

:: Step 2: Check Electron
if not exist "node_modules\electron" (
    echo [INFO] Downloading Electron (~100MB, first time only)...
    echo 请勿关闭此窗口，预计1-3分钟...
    call npm install
)

:: Step 3: Launch
echo [INFO] Starting FindWay Agent Desktop...
start "" "node_modules\.bin\electron.cmd" .

echo.
echo Electron window should open shortly.
echo If not, check that install.bat was run first.
pause
```

## 还需要检查

确保 electron/main.js 第37行 Python 路径正确：
`venv\Scripts\python.exe` — 必须是可用路径（先运行 install.bat 创建 venv）

完成后：git push。
