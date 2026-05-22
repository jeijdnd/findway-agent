# Continue 启动对话 —— Phase 2

> 直接复制下面全部内容，粘贴到Continue新对话中：

---

你是FindWay Agent项目的开发者。先了解当前进度，然后开始Phase 2开发。

## 第一步：了解当前状态

请依次读取以下文件：
1. `E:\曹铭睿\findway_agent\PROGRESS_BOARD.md` — 了解哪些任务完成了
2. `E:\曹铭睿\findway_agent\SESSION_REPORT.md` — 了解上次做了什么
3. `E:\曹铭睿\findway_agent\.continuerules` — 开发规则
4. `E:\曹铭睿\findway_agent\TECH_DECISIONS.md` — 技术决策

当前状态：Phase 0和Phase 1已完成，现在开始Phase 2。

## 第二步：本次任务（Phase 2 旧项目匹配）

### 任务 2.1：后端项目索引器
创建 `signage-app\backend\engine\indexer.py`：

```python
class ProjectIndexer:
    def scan_directory(self, dir_path: str):
        """
        扫描指定目录：
        - 递归查找所有 .xlsx 文件
        - 对每个Excel，读取第一个sheet的表头行
        - 提取文件名、sheet名、行数作为指纹
        - 返回指纹列表
        """
    
    def build_index(self, dir_path: str) -> dict:
        """
        调用 scan_directory，生成索引JSON
        保存到 backend/data/old_projects_index.json
        格式：{"projects": [...], "last_scan": "日期"}
        如果路径不存在，返回空列表+错误提示
        """
```

### 任务 2.2：后端匹配API
在 `signage-app\backend\api\matching.py` 新增：

- `POST /api/matching/search`
  - 输入：`{ "project_type": "学校", "keywords": "实验室" }`
  - 加载 `old_projects_index.json`
  - 计算匹配分数（类型匹配50% + 关键词匹配50%）
  - 返回 TOP 5，每项含：文件名、路径、分数、匹配原因
  - 如果索引文件不存在，返回提示"请先扫描旧项目目录"

- `POST /api/matching/scan`
  - 输入：`{ "dir_path": "E:\\旧项目" }`
  - 调用ProjectIndexer扫描
  - 返回扫描结果（找到N个项目）

- `GET /api/matching/preview/{project_id}`
  - 输入：项目在索引中的ID
  - 用openpyxl读取该Excel的前20行
  - 返回表格数据预览

### 任务 2.3：前端匹配页面
在 `AppLayout.jsx` 中完善 matching 标签页：
- 搜索表单：项目类型下拉 + 关键词输入 + "搜索"按钮
- 扫描区域：输入目录路径 + "扫描"按钮（调用 /api/matching/scan）
- 结果区域：匹配项目列表（显示文件名、类型、分数、原因）
- Loading/Empty/Error三态
- 点击项目展开显示款式预览表格

### 对话联动（增强）
在 `chat.py` 的意图识别中增强 `search_old_project` 意图：
- 如果用户说"搜索学校旧项目"，提取"学校"作为类型参数传给匹配API
- 如果用户说"搜索旧项目"，不传类型参数（全匹配）

## 第三步：完成后
1. 更新 `PROGRESS_BOARD.md`（任务2.1/2.2/2.3标记✅）
2. 在 `SESSION_REPORT.md` 末尾追加本次会话报告
