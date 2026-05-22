# Continue 启动对话 —— 直接复制粘贴

> 打开Continue新对话，把下面这段完整复制进去：

---

你是FindWay Agent项目的开发者。这是一个建筑导视标识设计AI助手桌面应用。

## 第一步：了解项目

请阅读以下文件来了解项目全貌：
1. `E:\曹铭睿\findway_agent\PRD.md` — 完整产品需求
2. `E:\曹铭睿\findway_agent\PROGRESS_BOARD.md` — 进度看板
3. `E:\曹铭睿\findway_agent\SESSION_REPORT.md` — 进度报告
4. `E:\曹铭睿\findway_agent\.continuerules` — 开发规则

## 第二步：搭建环境

我们要从零开始搭建开发环境。请按以下顺序执行：

### 1. 创建项目文件夹结构
在 `E:\曹铭睿\findway_agent` 下创建：
```
signage-app/
├── backend/
│   ├── api/
│   ├── engine/
│   └── data/
├── frontend/
│   └── src/
│       ├── pages/
│       ├── components/
│       └── utils/
└── backups/
```

### 2. Python虚拟环境
在 signage-app 中执行：
- `python -m venv venv`
- `venv\Scripts\pip install fastapi uvicorn openpyxl`

### 3. 后端骨架
创建 `signage-app\backend\main.py`：
- FastAPI应用
- GET /api/health 返回 {"status":"ok"}
- CORS只允许 localhost:5173
- 监听 127.0.0.1:8765
- uvicorn加 reload=True

### 4. React前端
在 `signage-app\frontend` 中：
- `npm create vite@latest . -- --template react`（如果目录非空，先清理）
- `npm install react-router-dom`
- vite.config.js配置：端口5173，代理/api到127.0.0.1:8765

### 5. 启动脚本
创建 `signage-app\start.bat`：
- 纯英文提示
- 先启动Python后端
- 等待后端就绪（curl检查health）
- 再启动Vite前端
- 自动打开浏览器

## 第三步：验证

完成后告诉我：
1. 双击start.bat能否正常启动
2. 浏览器能否看到React默认页面
3. http://localhost:8765/api/health 能否访问

## 第四步：输出进度

完成后请更新 `E:\曹铭睿\findway_agent\PROGRESS_BOARD.md`（任务0.1/0.2/0.3标记为✅）
然后在 `E:\曹铭睿\findway_agent\SESSION_REPORT.md` 末尾追加本次会话报告。

---

> 每完成一个Phase后，把 SESSION_REPORT.md 的内容发给我，我会告诉你下一步怎么做。
