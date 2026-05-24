# FindWay Agent 项目大纲

## 基本信息
- **技术栈**：Vite + React + MUI + Tailwind CSS（前端）；Python FastAPI（后端）；Electron（桌面壳）
- **项目路径**：E:\findway-agent-master\findway-agent-master\signage-app
- **创建日期**：2026-05-22
- **当前阶段**：V2 开发阶段 - Phase 0-6 已完成，开始 V2 升级

## 架构概览
项目采用前后端分离架构：
1. **前端**：React 18 + Vite 5，运行在 localhost:5173
2. **后端**：Python FastAPI，运行在 localhost:8765
3. **V2 新增**：Electron 桌面壳，将 Web 应用包装为桌面应用

## 功能模块

### 1. 对话框架（V1 Phase 1）
- 状态：✅ 完成
- 描述：左侧对话面板 + 右侧操作面板的左右分栏布局
- 文件：`frontend/src/App.jsx`, `ChatPanel.jsx`, `MainPanel.jsx`

### 2. 项目仪表盘（V1 Phase 1）
- 状态：✅ 完成
- 描述：项目卡片列表、新建/删除项目
- 文件：`frontend/src/pages/Dashboard.jsx`, `backend/api/projects.py`

### 3. 旧项目匹配（V1 Phase 2）
- 状态：✅ 完成
- 描述：扫描本地项目文件夹，建立索引，智能匹配旧项目
- 文件：`backend/engine/indexer.py`, `backend/api/matching.py`, `frontend/src/pages/OldProject.jsx`

### 4. 清单差异对比（V1 Phase 3）
- 状态：✅ 完成
- 描述：上传两个Excel清单，自动对比新增/删除/修改项
- 文件：`backend/engine/excel_engine.py`, `backend/engine/differ.py`, `backend/api/compare.py`, `frontend/src/pages/Compare.jsx`

### 5. 开发者控制台（V1 Phase 4）
- 状态：✅ 完成
- 描述：可视化配置界面，模块开关、匹配规则权重、清单模板字段
- 文件：`backend/api/settings.py`, `frontend/src/pages/Settings.jsx`

### 6. CAD图纸辅助（V1 Phase 5）
- 状态：✅ 完成
- 描述：读取DWG图纸，提取图框信息和标识图例
- 文件：`backend/engine/cad_engine.py`, `backend/api/cad.py`

### 7. 打包发布（V1 Phase 6）
- 状态：✅ 完成
- 描述：构建静态文件，生成安装脚本
- 文件：`start.bat`, `install.bat`

### 8. Electron桌面壳（V2 T01）
- 状态：✅ 完成
- 描述：用Electron包装Web应用，实现桌面应用体验
- 文件：`electron/main.js`, `electron/preload.js`

### 9. LLM对话引擎替换（V2 T02）
- 状态：✅ 完成
- 描述：OpenAI兼容API调用，流式输出，多API配置，意图识别
- 文件：`backend/services/llm_engine.py`, `backend/api/chat.py`, `backend/api/api_configs.py`

### 10. 多API配置面板（V2 P0-3）
- 状态：🔵 后端完成，前端待接入
- 描述：设置页面支持添加/编辑/删除多个LLM API，对话中可切换模型
- 文件：`backend/api/api_configs.py`（后端已完成）

### 11. 兔钉清单合并引擎（V2 T03）
- 状态：✅ 完成
- 描述：兔钉导出→完整清单编号匹配、数量填入、新增项标注
- 文件：`backend/services/merge_engine.py`, `backend/api/merge.py`

### 12. 本地目录扫描与自动发现（V2 P0-4）
- 状态：⬜ 未开始
- 描述：配置监控目录，递归扫描，自动发现项目文件夹
- 文件：待定

## 待办事项
- [x] 完成V2 T01：Electron桌面壳
- [x] 实现LLM对话引擎替换（V2 T02）
- [x] 实现兔钉清单合并引擎（V2 T03）
- [ ] 前端接入合并预览页 MergePreview.jsx
- [ ] 实现本地目录扫描与自动发现
- [ ] WPS清单识别与映射（P1）
- [ ] 格原协同平台接入（P1）
- [ ] 按任务自动切换模型（P1）

## 已知问题 / 踩坑记录
1. **V1 使用浏览器访问**：当前V1版本需要手动打开浏览器访问localhost，用户体验不够好
2. **AI对话为关键词匹配**：V1的AI对话只是简单的关键词意图识别，需要升级为真正的LLM驱动
3. **项目发现依赖手动创建**：用户需要手动创建项目卡片，需要实现自动扫描本地目录