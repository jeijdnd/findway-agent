# 变更日志

> 按时间倒序排列，最新的在最上面

---

## [2026-05-24] 会话开始

### 完成内容
- 创建项目记忆目录结构
- 初始化项目大纲、决策记录、变更日志
- 开始V2 T01任务：Electron桌面壳

### 修改文件
- `.workbuddy/project-memory/outline.md`：创建项目大纲
- `.workbuddy/project-memory/decisions.md`：记录关键决策
- `.workbuddy/project-memory/changelog.md`：创建变更日志

### 重要备注
- 项目已从V1（Phase 0-6完成）进入V2升级阶段
- 当前任务：V2 T01 — Electron桌面壳，包含5个子任务
- 需要创建Electron主进程、预加载脚本，修改package.json、vite.config.js、backend/main.py

---

## [2026-05-22] 项目初始设置

### 完成内容
- 创建项目结构
- 搭建Python FastAPI后端
- 搭建React + Vite前端
- 实现Phase 0-6的所有功能

### 修改文件
- `backend/main.py`：FastAPI应用入口
- `frontend/src/App.jsx`：React应用入口
- `start.bat`：一键启动脚本
- 等多个文件（详见PROGRESS_BOARD.md）

### 重要备注
- V1功能已完成，包括：对话框架、项目仪表盘、旧项目匹配、清单对比、控制台、CAD辅助、打包发布
- 项目结构：`signage-app/backend/`（Python后端）、`signage-app/frontend/`（React前端）