# FindWay Agent 开发进度看板

> **PM**：WorkBuddy（管控方向） | **Dev**：Continue（写代码）
> **机制**：Dev每次对话结束更新本文件 + 输出 SESSION_REPORT.md

---

## 进度总览

| Phase | 名称 | 任务数 | 状态 |
|-------|------|--------|------|
| Phase 0 | 环境搭建 | 3 | ✅ 完成 |
| Phase 1 | 对话框架 + 仪表盘 | 14 | ✅ 完成（会话2超额完成） |
| Phase 2 | 旧项目匹配 | 3 | ✅ 完成 |
| Phase 3 | 清单差异对比 | 4 | ✅ 完成 |
| Phase 4 | 开发者控制台 | 2 | ✅ 完成 |
| Phase 5 | CAD辅助 | 2 | ✅ 完成 |
| Phase 6 | 打包发布 | 2 | ✅ 完成 |
| V2 T01 | Electron桌面壳 | 5 | ✅ 完成 |
| V2 T02 | LLM对话引擎 + 多API后端 | 4 | ✅ 完成 |

---

## Phase 0：环境搭建（会话1）

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| 0.1 | Python虚拟环境 + FastAPI骨架 + health API | ✅ | fastapi+uvicorn+openpyxl+ezdxf |
| 0.2 | React+Vite前端 + 代理配置 | ✅ | React 18 + Vite 5 + react-router-dom |
| 0.3 | start.bat启动脚本 | ✅ | 自动启动前后端+打开浏览器 |

---

## Phase 1：对话框架 + 项目仪表盘

### 会话2：前端框架

| ID | 任务 | 状态 |
|----|------|------|
| 1.1 | App.jsx：左右分栏（对话40%+面板60%） | ✅ |
| 1.2 | ChatPanel.jsx：消息列表+输入框 | ✅ |
| 1.3 | MainPanel.jsx：标签切换+内容区 | ✅ |
| 1.4 | index.css：CSS变量+基础样式 | ✅ |

### 会话3：后端API

| ID | 任务 | 状态 |
|----|------|------|
| 1.5 | Pydantic模型+CRUD端点+JSON持久化 | ✅ |
| 1.6 | main.py：日志+异常处理+lifespan | ✅ |

### 会话4：前端组件+仪表盘

| ID | 任务 | 状态 |
|----|------|------|
| 1.7 | api.js：request+超时+CRUD | ✅ |
| 1.8 | ErrorBoundary+Loading+useApi | 🔧 | Dashboard直接处理了loading/error，够用 |
| 1.9 | Dashboard.jsx：卡片+表单+三态 | ✅ | 含Loading/Empty/Error三态 |

### 会话5：AI对话联网

| ID | 任务 | 状态 |
|----|------|------|
| 1.10 | ChatPanel.jsx：消息气泡+发送接收 | ✅ | 含超时/错误处理 |
| 1.11 | backend/api/chat.py：意图识别+对话API | ✅ | 关键词识别5种意图 |
| 1.12 | 对话面板联动 | ✅ | onAction回调切换面板 |
| 1.13 | 对话历史持久化 | ✅ | JSON文件存储 |

---

## Phase 2：旧项目匹配

| ID | 任务 | 会话 | 状态 |
|----|------|------|------|
| 2.1 | 项目索引器 | 6 | ✅ |
| 2.2 | 匹配API | 6 | ✅ |
| 2.3 | 搜索页面+对话联动 | 7 | ✅ |

---

## Phase 3：清单对比

| ID | 任务 | 会话 | 状态 |
|----|------|------|------|
| 3.1 | Excel读取引擎 | 8 | ✅ |
| 3.2 | 差异对比引擎 | 8 | ✅ |
| 3.3 | 对比API+导出 | 9 | ✅ |
| 3.4 | 对比页面 | 10 | ✅ |

---

## Phase 4：控制台

| ID | 任务 | 会话 | 状态 |
|----|------|------|------|
| 4.1 | 配置API+热重载 | 11 | ✅ |
| 4.2 | 控制台页面 | 11 | ✅ |

---

## Phase 5：CAD

| ID | 任务 | 会话 | 状态 |
|----|------|------|------|
| 5.1 | DWG读取引擎 | 12 | ✅ |
| 5.2 | 图框API | 13 | ✅ |

---

## Phase 6：打包

| ID | 任务 | 会话 | 状态 |
|----|------|------|------|
| 6.1 | 构建+静态服务 | 14 | ✅ |
| 6.2 | 一键安装脚本 | 14 | ✅ |
| 6.3 | bat文件编码修复 | 15 | ✅ |
| 6.4 | 启动Bug修复 | 16 | ✅ |

> ⬜未开始 | 🔵进行中 | ✅完成 | ❌阻塞

---

## V2 升级：Electron桌面壳（会话17）

### V2 T01：Electron桌面壳

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| T01.1 | signage-app/electron/main.js（新建）— Electron主进程 | ✅ | 包含窗口管理、系统托盘、Python子进程启动、健康检查轮询 |
| T01.2 | signage-app/electron/preload.js（新建）— IPC桥接 | ✅ | 暴露window.electronAPI给渲染进程 |
| T01.3 | signage-app/package.json（修改）— 添加Electron相关配置 | ✅ | 添加main字段、scripts、devDependencies |
| T01.4 | signage-app/frontend/vite.config.js（修改）— 适配Electron | ✅ | base改为'./'相对路径 |
| T01.5 | signage-app/backend/main.py（修改）— 增强启动配置 | ✅ | 从环境变量PORT读取端口，增强健康检查接口 |

### V2 T01 完成说明

**Electron主进程功能**：
- 创建BrowserWindow（宽1400×高900，最小800×600）
- 使用electron-store记忆窗口位置/大小
- 系统托盘：右键菜单「显示主窗口」「退出」
- 关闭窗口不退出，隐藏到托盘；托盘退出时先kill Python子进程
- child_process.spawn启动Python后端（python backend/main.py，环境变量PORT=8765）
- 启动后轮询GET http://127.0.0.1:8765/api/health，最多30次间隔500ms
- 超时显示错误对话框"Python 后端启动失败"
- 开发模式加载http://localhost:5173，生产模式加载http://127.0.0.1:8765

**技术决策**：
- 使用electron-store存储窗口状态
- 使用concurrently同时启动前端开发服务器和Electron
- 使用wait-on等待前端服务器就绪后启动Electron
- 开发模式判断标准：process.env.NODE_ENV !== 'production'

**验证状态**：
- [ ] 安装Electron依赖：npm install
- [ ] 启动开发模式：npm run electron-dev
- [ ] 构建生产版本：npm run electron-build
- [ ] 测试系统托盘功能
- [ ] 测试窗口位置记忆

---

## V2 升级：LLM对话引擎（会话18）

### V2 T02：LLM对话引擎 + 多API后端

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| T02.1 | signage-app/backend/services/llm_engine.py（新建）— LLM引擎核心 | ✅ | AsyncOpenAI、流式/非流式对话、意图识别、多API配置 |
| T02.2 | signage-app/backend/api/chat.py（修改）— 流式端点+模型列表 | ✅ | POST /api/chat/stream、GET /api/chat/models，旧端点改调 llm_engine |
| T02.3 | signage-app/backend/api/api_configs.py（新建）— 多API配置CRUD | ✅ | GET/POST/PUT/DELETE + test 连通性 |
| T02.4 | signage-app/backend/config.json（修改）— LLM段重构 | ✅ | apis 数组 + default_api，保留其他配置段 |

### V2 T02 完成说明

**LLM引擎功能**：
- 封装 openai.AsyncOpenAI，从 config.json 读取多 API 配置
- `chat_stream()` 逐 token 流式输出
- `chat()` 非流式完整回复
- `infer_intent()` LLM 意图识别 + 关键词降级
- 错误消息脱敏，不暴露 api_key

**新增 API 端点**：
- `POST /api/chat/stream` — SSE 流式对话
- `GET /api/chat/models` — 已启用模型列表
- `GET/POST/PUT/DELETE /api/api-configs` — 多 API 配置 CRUD
- `POST /api/api-configs/{id}/test` — Hello 连通性测试

**依赖**：openai >= 1.30.0（install.bat / run.bat 已更新）