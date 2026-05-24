# 变更日志

> 按时间倒序排列，最新的在最上面

---

## [2026-05-24] 会话19：V2 T03 兔钉清单合并引擎完成

### 完成内容
- 创建 merge_engine.py 兔钉清单合并引擎
- 创建 merge.py 合并 API（preview/apply/templates）
- 注册路由，更新 PROGRESS_BOARD 和 SESSION_REPORT

### 修改文件
- `signage-app/backend/services/merge_engine.py`：新建
- `signage-app/backend/api/merge.py`：新建
- `signage-app/backend/main.py`：注册 merge 路由

### 重要备注
- V2 T03 核心功能完成，需真实样本文件做端到端验证

---

## [2026-05-24] 会话18：V2 T02 LLM对话引擎完成

### 完成内容
- 创建 LLM 引擎核心模块 llm_engine.py
- 修改 chat.py 支持流式 SSE 和非流式 LLM 对话
- 创建 api_configs.py 多 API 配置 CRUD
- 重构 config.json LLM 配置段为多 API 结构
- 更新 PROGRESS_BOARD.md 和 SESSION_REPORT.md

### 修改文件
- `signage-app/backend/services/llm_engine.py`：新建
- `signage-app/backend/api/chat.py`：流式端点、模型列表、LLM 集成
- `signage-app/backend/api/api_configs.py`：新建
- `signage-app/backend/config.json`：LLM apis 数组
- `signage-app/backend/main.py`：注册路由
- `signage-app/install.bat`、`run.bat`：openai 依赖

### 重要备注
- V2 T02 全部完成，需配置 API Key 后方可真实调用 LLM

---

## [2026-05-24] 会话17：V2 T01 Electron桌面壳完成

### 完成内容
- 创建Electron主进程文件：`signage-app/electron/main.js`
- 创建Electron预加载脚本：`signage-app/electron/preload.js`
- 创建项目根目录package.json：`signage-app/package.json`
- 修改Vite配置：`signage-app/frontend/vite.config.js` base改为相对路径
- 修改后端配置：`signage-app/backend/main.py` 从环境变量读取端口，增强健康检查接口
- 更新项目进度看板：`PROGRESS_BOARD.md` 添加V2 T01完成记录
- 更新会话报告：`SESSION_REPORT.md` 添加会话17报告
- Git提交并推送：`feat: V2 T01 Electron桌面壳实现`

### 修改文件
- `signage-app/electron/main.js`：新建，Electron主进程
- `signage-app/electron/preload.js`：新建，IPC桥接
- `signage-app/package.json`：新建，Electron配置
- `signage-app/frontend/vite.config.js`：修改，base改为'./'
- `signage-app/backend/main.py`：修改，端口配置和健康检查增强
- `PROGRESS_BOARD.md`：修改，添加V2 T01任务
- `SESSION_REPORT.md`：修改，添加会话17报告
- `.workbuddy/project-memory/outline.md`：创建项目大纲
- `.workbuddy/project-memory/decisions.md`：记录关键决策
- `.workbuddy/project-memory/changelog.md`：创建变更日志

### 重要备注
- V2 T01任务全部完成，Electron桌面壳功能已实现
- 主要功能：窗口管理、系统托盘、Python子进程启动、健康检查轮询
- 待验证：需要安装Electron依赖并测试功能
- Git提交成功，但推送需要认证（用户可手动推送）

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