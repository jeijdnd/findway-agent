⚠️ 先 git pull

@PROGRESS_BOARD.md

Bug修复：desktop.bat 报错 't'/'Step'/'ilding' 不是内部或外部命令。

## 问题定位

**根因：文件编码是 UTF-8，但 Windows cmd.exe 默认用 GBK 读取。**

第18行 `请勿关闭此窗口` 这些中文字符在GBK下被错误解析，字节碎片被当成命令执行，导致 `Step`、`ilding`（Building碎片）、`t`（start碎片）等乱报错。

## 修复方式

重写 signage-app\desktop.bat，用纯英文，不用中文：

```bat
@echo off
chcp 65001 >nul
title FindWay Agent - Desktop

cd /d "%~dp0"

:: Step 1: Check frontend build
if not exist "frontend\dist\index.html" (
    echo [INFO] Building frontend...
    cd frontend
    call npm install
    call npm run build
    cd ..
)

:: Step 2: Check Electron  
if not exist "node_modules\electron" (
    echo [INFO] Installing Electron (~100MB, one-time)...
    echo DO NOT close this window
    call npm install
)

:: Step 3: Launch
echo [INFO] Starting FindWay Agent Desktop...
start "" "node_modules\.bin\electron.cmd" .

echo.
echo Electron should open shortly.
echo If nothing happens, run install.bat first.
pause
```

## 关键修复
- 第二行加 `chcp 65001 >nul`（切换cmd到UTF-8模式）
- 所有中文提示改为英文（彻底避开编码问题）
- 其余逻辑不变

完成后 git push。
