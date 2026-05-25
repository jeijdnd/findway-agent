⚠️ 先 git pull

@PROGRESS_BOARD.md

Bug：desktop.bat 不闪退了，但 Electron 窗口一闪就关。

## 诊断

bat 脚本的 pause 是有效的（cmd窗口不关了），说明是 **Electron 自身启动崩溃**。

最可能原因：
1. `electron/main.js` 第5行 `const Store = require('electron-store')` — electron-store 未安装
2. Python 后端启动失败导致 Electron 进程退出
3. 其他 require 的模块缺失

## 修复

### Fix 1：检查缺少的依赖

在 `signage-app/` 目录运行：
```
call npm install electron-store
```
或确认 package.json devDependencies 中 electron-store 版本正确。

### Fix 2：给 electron/main.js 加崩溃保护

在 `startPythonBackend()` 和 `createWindow()` 函数里，用 try-catch 包裹，出错时用 `dialog.showErrorBox()` 弹窗显示错误信息，而不是直接崩溃。

具体修改 electron/main.js：
- `startPythonBackend()` 加 try-catch，catch 里 `dialog.showErrorBox('Backend Error', err.message)`
- `createWindow()` 加 try-catch
- win.loadURL 失败时用 `dialog.showErrorBox` 弹窗

### Fix 3：验证步骤

修复后不要直接双击。先在 signage-app 目录的终端里手动跑：
```
node_modules\.bin\electron.cmd .
```
这样能看到控制台输出的错误信息。

## 约束
只改 electron/main.js（加错误处理）。
不改 desktop.bat 和其他文件。

完成后 git push。
