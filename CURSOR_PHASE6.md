@PROGRESS_BOARD.md

当前：Phase 0-5 完成。最后一站——Phase 6：打包发布。

## 本次任务（Phase 6）

### 6.1 前端生产构建 + 后端集成

1. 在 `signage-app\frontend` 执行 `npm run build`，生成 dist 目录
2. 修改 `signage-app\backend\main.py`：
   - 添加静态文件服务：生产模式下 serve 前端 dist 文件
   - 判断逻辑：如果 `frontend/dist/index.html` 存在 → 生产模式，否则 → 开发模式
   - 生产模式下，所有非 /api/ 的请求都返回 index.html（React SPA路由）

3. 启动方式简化：
   - 写一个 `signage-app\run.bat`：只启动后端（不再需要单独启动Vite）
   - 双击 run.bat → 浏览器打开 `http://localhost:8765` → 前后端一体化

### 6.2 一键安装脚本

写一个 `signage-app\install.bat`，新电脑只需双击：

```bat
@echo off
:: 检查Python
python --version >nul 2>&1 || (echo Please install Python 3.10+ && pause && exit /b 1)
:: 检查Node
node --version >nul 2>&1 || (echo Please install Node.js 18+ && pause && exit /b 1)
:: 创建虚拟环境
python -m venv venv
:: 装Python依赖
venv\Scripts\pip install fastapi uvicorn openpyxl ezdxf
:: 装前端依赖并构建
cd frontend
call npm install
call npm run build
cd ..
echo.
echo Install complete! Double-click run.bat to start.
pause
```

## 完成后
更新 PROGRESS_BOARD.md（Phase 6 ✅）+ SESSION_REPORT.md + git push。

这是最后一个Phase，完成后整个项目即可在任何电脑上一键安装运行。
