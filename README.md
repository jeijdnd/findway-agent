# FindWay Agent

建筑导视标识设计AI助手 —— 桌面应用

## 新电脑 5 分钟上手

新电脑 clone 项目后，按顺序读：

| 顺序 | 文件 | 内容 | 读完知道什么 |
|------|------|------|------------|
| 1️⃣ | `README.md` | 这个文件 | 项目是什么，文档在哪 |
| 2️⃣ | `PRD.md` | 产品需求（V3.0） | 这个软件要做什么、为什么做 |
| 3️⃣ | `PROGRESS_BOARD.md` | 进度看板 | 当前做到哪了、下一步做什么 |
| 4️⃣ | `TECH_DECISIONS.md` | 技术决策 | 技术栈、为什么不选其他方案 |
| 5️⃣ | `SESSION_REPORT.md` | 最近一次报告 | 上次会话做了什么 |

读完这5个文件，你就完全了解整个项目了。然后直接开 Cursor 新对话开始开发。

## 文档索引

| 文件 | 用途 | 什么时候读 |
|------|------|-----------|
| `PRD.md` | 完整产品需求 | 第一次接触项目时 |
| `DEVELOPMENT_ROADMAP.md` | 开发路线图 | 想了解全景规划时 |
| `PROGRESS_BOARD.md` | 进度看板 | **每次开始前必读** |
| `SESSION_REPORT.md` | 会话进度报告 | 了解上次做了什么 |
| `TECH_DECISIONS.md` | 技术决策记录 | 想了解为什么这样设计 |
| `.cursorrules` | Cursor AI规则 | 自动加载，不需手动读 |
| `CURSOR_PHASE*.md` | 各阶段开发指令 | Cursor对话时引用 |

## 开发角色

| 角色 | 工具 | 做什么 |
|------|------|--------|
| **PM** | WorkBuddy | 管控方向、审查进度、解决阻塞 |
| **Dev** | Cursor | 按 PROGRESS_BOARD.md 写代码 |

## 技术栈

Python FastAPI + React Vite + 本地JSON存储

## 启动

```
双击 signage-app/start.bat
浏览器自动打开 localhost:5173
```

## Git 工作流

```
开始工作: git pull
结束工作: git add -A && git commit -m "Phase X: ..." && git push
```
