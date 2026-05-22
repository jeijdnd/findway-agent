# 标识Agent 开发路线图

> **这份文档是给你自己开发用的**：按阶段走，每个任务都有给CodeBuddy的现成指令模板。
> **从零开始**：不需要任何现有代码，跟着Phase 0搭环境，Phase 1出第一个功能。
> 需求细节见 `PRD-标识Agent需求文档.md`

---

## 零、开始之前

### 你要创建的软件长什么样

```
┌──────────────────────────────────────────┐
│  标识Agent                     [设置] [×]│
├──────────────┬───────────────────────────┤
│              │                           │
│  🤖 AI对话   │    📊 操作面板             │
│  (左侧40%)   │    (右侧60%)              │
│              │                           │
│  像微信/QQ   │   项目卡片、清单对比        │
│  一样的聊    │   规范查询结果等            │
│  天界面      │                           │
│              │                           │
│  你说"创建   │   自动切换到对应面板         │
│  项目" →     │   显示操作结果              │
│  AI帮你执行  │                           │
│              │                           │
│ ┌──────────┐ │                           │
│ │输入消息...│ │                           │
│ └──────────┘ │                           │
└──────────────┴───────────────────────────┘
```

### 你需要准备什么

| 工具 | 怎么装 |
|------|--------|
| Python 3.10+ | [python.org](https://python.org) 下载 |
| Node.js 18+ | [nodejs.org](https://nodejs.org) 下载 |
| CodeBuddy | 你已经有了 |
| LLM API Key | OpenAI兼容的API Key（用来驱动AI对话） |

### 创建全新的项目文件夹

```
E:\曹铭睿\标识agent\signage-app\   ← 所有代码放这里
```

如果这个文件夹已经存在旧代码，**删掉重新来**，或者用一个新的文件夹名如 `signage-app-v2`。

---

## 一、整体开发路线

```
Phase 0: 环境搭建       ████░░░░░░░░░░░░░░  （约1小时，一次性）
Phase 1: 对话框架+仪表盘 ████████░░░░░░░░░░  （约3-4天）
Phase 2: 旧项目匹配      ████████░░░░░░░░░░  （约2-3天）
Phase 3: 清单差异对比    ████████░░░░░░░░░░  （约3-4天）
Phase 4: 开发者控制台    ████░░░░░░░░░░░░░░  （约2天）
Phase 5: CAD辅助         ██████░░░░░░░░░░░░  （约3-5天）
Phase 6: 打包发布        ██░░░░░░░░░░░░░░░░  （约1-2天）
```

每个Phase可以独立开发和测试，不依赖后续Phase。

---

## Phase 0：环境搭建（从零开始）

> 目标：能用浏览器打开 `http://localhost:5173` 看到一个React页面，并且访问 `/api/health` 返回 `{"status":"ok"}`。

### 任务 0.1：建项目文件夹 + Python环境

**给CodeBuddy的指令：**

```
帮我在 E:\曹铭睿\标识agent 下创建 signage-app 文件夹，然后：

1. 在 signage-app 里运行 python -m venv venv 创建虚拟环境
2. 用 venv 安装这三个包：fastapi uvicorn openpyxl
3. 创建 backend/main.py，内容是一个最简单的 FastAPI 应用：
   - GET /api/health 返回 {"status":"ok"}
   - CORS 只允许 localhost:5173
   - 启动在 127.0.0.1:8765
4. 创建 requirements.txt 记录依赖
```

### 任务 0.2：创建前端项目

**给CodeBuddy的指令：**

```
在 E:\曹铭睿\标识agent\signage-app 下：

1. 在 frontend 目录用 Vite 创建一个 React 项目
2. 安装 react-router-dom
3. 在 vite.config.js 中配置：
   - 开发服务器端口 5173
   - 代理 /api 到 http://127.0.0.1:8765
```

### 任务 0.3：写启动脚本

**给CodeBuddy的指令：**

```
在 E:\曹铭睿\标识agent\signage-app 下写一个 start.bat：

要求：
- 所有提示用英文（不要中文，防止编码乱码）
- 先启动后端（venv\Scripts\python.exe backend\main.py）
- 用 timeout 等待3秒
- 循环curl检查 http://127.0.0.1:8765/api/health 直到返回ok
- 再启动前端（cd frontend && node_modules\.bin\vite.cmd --host）
- 自动打开浏览器 http://localhost:5173
- 如果Python或vite不存在，显示明确错误信息而不是闪退
```

**验证**：双击 start.bat → 浏览器自动打开 → 看到React默认页面 → Phase 0 完成。

---

## Phase 1：对话框架 + 项目仪表盘（MVP核心）

> 目标：左侧能聊天，右侧能管理项目。这是最重要的一个阶段。

### 任务 1.1：前端基础框架（左右分栏布局）

| 项目 | 内容 |
|------|------|
| **目标** | 搭建左右分栏的主界面框架 |
| **文件** | `App.jsx`、`ChatPanel.jsx`、`MainPanel.jsx`、`index.css` |

**给CodeBuddy的指令：**

```
在 E:\曹铭睿\标识agent\signage-app\frontend\src 帮我搭建界面框架：

1. App.jsx：左右分栏布局
   - 左侧 40%：ChatPanel（对话区）
   - 右侧 60%：MainPanel（操作面板）
   - 中间一条可拖拽的分隔线

2. ChatPanel.jsx（先做壳子，后面再实现AI对话）：
   - 顶部："AI助手"标题
   - 中间：消息列表区域（预留滚动，暂时显示"对话功能开发中"）
   - 底部：输入框 + 发送按钮（暂时不可用，灰色状态）

3. MainPanel.jsx：
   - 顶部导航：项目仪表盘/旧项目匹配/清单对比/控制台 四个标签
   - 下方内容区：根据当前标签切换显示对应页面
   - 默认显示 Dashboard

4. index.css：
   - 定义CSS变量：主色#4f46e5，背景#f8f9fb，文字#1e293b和#64748b
   - 左右分栏：flex布局，高度100vh
   - 分隔线：可拖拽，hover时变色
```

### 任务 1.2：后端项目管理API

| 项目 | 内容 |
|------|------|
| **目标** | 完整的项目增删改查 |
| **文件** | `backend/api/projects.py` |

**给CodeBuddy的指令：**

```
在 E:\曹铭睿\标识agent\signage-app\backend\api\projects.py 中写项目管理API：

1. Pydantic模型：
   - ProjectCreate：name(必填,1-100字)、project_type(学校/办公/住宅/实验室/产业园/医院/其他)、stage(清单阶段/施工图阶段/交付阶段/配合阶段)、buildings(楼栋列表)
   - ProjectUpdate：所有字段可选
   - 自动生成id(8位随机)、created_at、updated_at

2. 5个端点：
   - GET /api/projects → 列表（按更新时间倒序）
   - POST /api/projects → 创建（含字段校验）
   - GET /api/projects/{id} → 单个
   - PUT /api/projects/{id} → 更新
   - DELETE /api/projects/{id} → 删除

3. JSON文件持久化：backend/data/projects_index.json
4. 错误处理：400(字段不合法)、404(不存在)、500(服务器错误)
```

### 任务 1.3：后端添加日志和异常处理

| 项目 | 内容 |
|------|------|
| **目标** | 结构化日志 + 全局异常拦截 |
| **文件** | `backend/main.py` |

**给CodeBuddy的指令：**

```
帮我完善 E:\曹铭睿\标识agent\signage-app\backend\main.py：

1. 添加 logging 模块：格式 "时间 [级别] 模块名: 消息"
2. 用 @asynccontextmanager lifespan 管理生命周期
3. 全局异常处理：捕获所有 Exception → 返回500 + 错误信息
4. uvicorn.run 加 reload=True（开发热重载）
5. CORS 只允许 localhost:5173
```

### 任务 1.4：前端API通信层 + 通用组件

| 项目 | 内容 |
|------|------|
| **目标** | api.js + ErrorBoundary + Loading + useApi |
| **文件** | `api.js`、`utils/` 目录下三个文件 |

**给CodeBuddy的指令：**

```
在 E:\曹铭睿\标识agent\signage-app\frontend\src 中：

1. api.js：
   - 通用 request() 函数：10秒超时(AbortController)、自动错误处理
   - 导出 healthCheck、listProjects、createProject、getProject、updateProject、deleteProject

2. utils/ErrorBoundary.jsx：
   - React Class组件，捕获子组件渲染错误
   - 显示错误信息 + 重试按钮

3. utils/Loading.jsx：
   - 旋转动画 + 可选文字

4. utils/useApi.js：
   - 自动管理 loading/error/data 三个状态
   - 返回 { data, loading, error, refetch }
```

### 任务 1.5：项目仪表盘页面

| 项目 | 内容 |
|------|------|
| **目标** | 完整的Dashboard页面 |
| **文件** | `pages/Dashboard.jsx` |

**给CodeBuddy的指令：**

```
在 E:\曹铭睿\标识agent\signage-app\frontend\src\pages\Dashboard.jsx 中：

1. 页面结构：
   - 顶部：标题"+项目仪表盘"+"+新建项目"按钮
   - 项目卡片列表（名称、阶段标签、类型、楼栋数、删除按钮）
   
2. 三种状态覆盖：Loading/Empty/Error

3. 新建项目表单（弹窗或展开式均可）：
   - 项目名称（文本）、类型（下拉）、阶段（下拉）
   - 提交后刷新列表

4. 阶段标签颜色：清单阶段=绿色、施工图=蓝色、交付=橙色、配合=灰色

5. ErrorBoundary包裹整个页面
```

### 任务 1.6：AI对话界面（核心！）

| 项目 | 内容 |
|------|------|
| **目标** | 左侧聊天界面能收发消息，AI能回复 |
| **文件** | `ChatPanel.jsx`、`backend/api/chat.py` |

**给CodeBuddy的指令（前端部分）：**

```
完善 E:\曹铭睿\标识agent\signage-app\frontend\src\ChatPanel.jsx：

1. 消息列表：
   - 用户消息靠右（蓝色气泡）
   - AI消息靠左（灰色气泡）
   - 自动滚到底部（新消息来了就滚）
   - 显示时间戳

2. 输入区：
   - 固定在底部
   - 输入框 + 发送按钮
   - 回车发送，Shift+回车换行
   - 发送中显示"..."动画，禁用输入

3. 状态管理：
   - messages: [{role, content, time}, ...]
   - 发送 → POST /api/chat → 接收 → 追加到消息列表

4. 欢迎消息：首次打开显示"你好！我是标识Agent助手，有什么可以帮你的？"
```

**给CodeBuddy的指令（后端部分）：**

```
在 E:\曹铭睿\标识agent\signage-app\backend\api\chat.py 中写AI对话API：

1. POST /api/chat：
   输入：{ "message": "用户说的话", "history": [之前的对话] }
   
2. 意图识别（先做简单的关键词匹配，后续接入LLM）：
   - 包含"创建"+"项目" → 意图: create_project
   - 包含"删除"+"项目" → 意图: delete_project  
   - 包含"列表"+"项目" → 意图: list_projects
   - 包含"对比"+"清单" → 意图: compare
   - 包含"规范"+"要求" → 意图: query_spec
   - 其他 → 意图: chat（通用对话）

3. 根据意图执行对应操作并返回回复：
   - create_project → 提取项目名和类型 → 调用projects.py创建 → 回复"已创建xx项目"
   - list_projects → 调用projects.py列表 → 回复项目摘要
   - 其他意图 → 回复引导性文字

4. GET /api/chat/history → 返回对话历史（存为JSON文件）

5. 对话历史持久化到 backend/data/chat_history.json
```

**验证 Phase 1 完成的标准**：
- [ ] start.bat 能正常启动
- [ ] 浏览器打开看到左右分栏界面
- [ ] 右侧能新建项目、显示项目列表、删除项目
- [ ] 左侧输入"帮我创建一个珠海理工的学校项目"→ AI回复"已创建"→ 右侧自动显示新项目
- [ ] 刷新页面后，项目和对话历史都还在

---

## Phase 2：旧项目智能匹配

> 目标：扫描本地旧项目文件夹，建立索引，输入新项目特征能推荐最匹配的旧项目。

### 任务 2.1：项目文件索引器

| 项目 | 内容 |
|------|------|
| **目标** | 扫描指定目录，提取项目指纹 |
| **文件** | `backend/engine/indexer.py` |

**给CodeBuddy的指令：**

```
在 E:\曹铭睿\标识agent\signage-app\backend\engine\indexer.py 中：

写一个 ProjectIndexer 类：

1. scan_directory(dir_path)：
   - 递归扫描目录下所有 .xlsx 文件
   - 对每个Excel，尝试读取第一个sheet的头几行
   - 提取项目名称（如果有）
   - 生成项目指纹：文件路径、文件名、项目类型推测（从路径/文件名推断）、Excel sheet名称列表
   - 返回指纹列表

2. build_index(dir_path, output_path)：
   - 调用 scan_directory
   - 将结果保存为JSON：backend/data/projects_index.json
   - 格式：{"projects": [...fp], "last_scan": "..."}

3. 只读不写，不修改任何Excel文件
```

### 任务 2.2：匹配算法

| 项目 | 内容 |
|------|------|
| **目标** | 按相似度排序旧项目 |
| **文件** | `backend/api/matching.py` |

**给CodeBuddy的指令：**

```
在 E:\曹铭睿\标识agent\signage-app\backend\api\matching.py 中写匹配API：

1. POST /api/matching/search：
   - 输入：{ project_type, buildings: [...], keywords: [...] }
   - 加载 projects_index.json
   - 计算每个旧项目的相似度分数：
     - 类型匹配：50%
     - 楼栋结构相似度（数量相近）：30%
     - 关键词匹配（文件名/路径出现关键词）：20%
   - 返回 TOP 5，按分数降序
   - 每个结果包含：项目名、路径、分数、匹配原因

2. GET /api/matching/preview/{project_id}：
   - 读取指定旧项目的Excel清单
   - 返回款式概览（前20行）
```

### 任务 2.3：匹配页面 + 对话联动

| 项目 | 内容 |
|------|------|
| **目标** | 搜索表单+结果列表，且能从对话触发 |
| **文件** | `pages/OldProject.jsx` |

**给CodeBuddy的指令：**

```
重写 E:\曹铭睿\标识agent\signage-app\frontend\src\pages\OldProject.jsx：

1. 搜索表单：类型下拉+楼栋数量+关键词+"搜索"按钮

2. 结果列表：匹配项目卡片，显示名称、分数、原因
   点击展开：款式预览表格

3. 对话联动（重要！）：
   - 当用户在对话中说"帮我找类似的学校项目"
   - ChatPanel触发 → 切换到本页面 → 自动填入"学校"并搜索
   - 搜索结果同步显示在对话区（"找到3个匹配项目：..."）

---

## Phase 3：清单差异对比

> 目标：上传两个Excel，自动对比找出新增/删除/修改。

### 任务 3.1：Excel读取引擎

| 项目 | 内容 |
|------|------|
| **目标** | 标准化读取标识清单Excel |
| **文件** | `backend/engine/excel_engine.py` |

**给CodeBuddy的指令：**

```
在 E:\曹铭睿\标识agent\signage-app\backend\engine\excel_engine.py 中：

写一个 ExcelEngine 类：

1. read_signage_list(file_path, sheet_name=None)：
   - 用 openpyxl 读取
   - 如果sheet_name为空，自动识别（第一个非空sheet或名为"款式总览"的sheet）
   - 自动检测表头行（通常是第一行）
   - 提取列：编号、名称、尺寸、材质、带电、单位、数量、备注
   - 返回结构化列表：[{编号,名称,尺寸,...}, ...]

2. detect_structure(file_path)：
   - 返回Excel的sheet名称列表
   - 对每个sheet，返回列名和前3行数据预览
```

### 任务 3.2：差异对比引擎

| 项目 | 内容 |
|------|------|
| **目标** | 计算两个清单的差异 |
| **文件** | `backend/engine/differ.py` |

**给CodeBuddy的指令：**

```
在 E:\曹铭睿\标识agent\signage-app\backend\engine\differ.py 中：

写一个 ListDiffer 类：

1. compare(list_a, list_b, key_field="编号")：
   - 按 key_field 匹配两边的行
   - 分为四类：
     - added：B有A无 → type: "新增"
     - removed：A有B无 → type: "删除"  
     - modified：两边都有但其他字段不同 → type: "修改"，标注 changed_fields
     - unchanged：完全相同 → type: "不变"
   - 返回 { summary: {added:N, removed:N, modified:N, unchanged:N}, details: [...] }

2. export_diff(diff_result, output_path)：
   - 生成一个Excel差异报告
   - 新增行绿色背景，删除行红色背景，修改行黄色背景
   - 修改行旁边标注具体改了哪个字段
```

### 任务 3.3：对比API

| 项目 | 内容 |
|------|------|
| **目标** | 提供文件上传对比接口 |
| **文件** | `backend/api/compare.py` |

**给CodeBuddy的指令：**

```
在 E:\曹铭睿\标识agent\signage-app\backend\api\compare.py 中：

1. POST /api/compare：
   - 接受两个文件上传：file_a（旧版）、file_b（新版）
   - 用 excel_engine 读取两个文件
   - 用 differ 对比
   - 返回差异JSON

2. POST /api/compare/export：
   - 接受两个文件上传
   - 返回一个可下载的差异Excel文件
```

### 任务 3.4：对比页面

| 项目 | 内容 |
|------|------|
| **目标** | 拖入两个Excel看差异 |
| **文件** | `pages/Compare.jsx` |

**给CodeBuddy的指令：**

```
重写 E:\曹铭睿\标识agent\signage-app\frontend\src\pages\Compare.jsx：

1. 布局：左右两栏各放一个文件拖放区
   - 左：旧版清单（蓝色虚线框）
   - 右：新版清单（橙色虚线框）
   - 支持拖拽 .xlsx 文件或点击选择

2. 两个文件都上传后 → 自动调用 /api/compare

3. 结果展示：
   - 顶部卡片：变化汇总（新增X项/删除Y项/修改Z项/不变W项）
   - 下方表格：差异详情
     - 新增行绿色背景
     - 删除行红色背景  
     - 修改行黄色背景，标注改了哪个字段
   - 支持筛选：只看新增/只看修改/只看删除

4. "导出报告"按钮 → 下载差异Excel
```

---

## Phase 4：开发者控制台

> 目标：不写代码就能改配置——模块开关、匹配规则权重、清单模板字段。

### 任务 4.1：配置管理API

| 项目 | 内容 |
|------|------|
| **目标** | 读写运行时配置文件 |
| **文件** | `backend/api/settings.py` |

**给CodeBuddy的指令：**

```
在 E:\曹铭睿\标识agent\signage-app\backend\api\settings.py 中：

1. GET /api/settings → 返回当前 config.json 内容

2. PUT /api/settings → 更新 config.json，验证字段合法性后保存

3. POST /api/settings/reload → 强制重新加载配置（热重载）

config.json 结构：
{
  "modules": {"project_matching": true, "list_compare": true, "cad_assist": false, "spec_query": false},
  "matching_rules": {"type_weight": 0.5, "structure_weight": 0.3, "time_weight": 0.2, "max_results": 5},
  "list_template": {"columns": ["编号","名称","尺寸","材质","是否带电","单位","数量","备注"]}
}
```

### 任务 4.2：控制台页面

| 项目 | 内容 |
|------|------|
| **目标** | 可视化配置界面 |
| **文件** | `pages/Settings.jsx` |

**给CodeBuddy的指令：**

```
重写 E:\曹铭睿\标识agent\signage-app\frontend\src\pages\Settings.jsx：

1. 模块开关区：
   - 4个开关：旧项目匹配/清单对比/CAD辅助/规范查询
   - 每个开关旁有简短说明

2. 匹配规则区：
   - 类型权重、结构权重、时间权重 → 三个滑块（0~1，总和自动校准显示）
   - 最大结果数 → 数字输入

3. 清单模板区：
   - 显示当前8个列名
   - 可添加/删除/排序列
   - "重置为默认"按钮

4. 保存按钮 → 调用 PUT /api/settings
5. 保存后显示"配置已更新，部分修改需刷新页面生效"
```

---

## Phase 5：CAD图纸辅助

> 目标：读取DWG图纸，提取图框信息和标识图例。

### 任务 5.1：DWG读取

| 项目 | 内容 |
|------|------|
| **目标** | 读取DWG文件的结构化信息 |
| **文件** | `backend/engine/cad_engine.py` |

**给CodeBuddy的指令：**

```
在 E:\曹铭睿\标识agent\signage-app\backend\engine\cad_engine.py 中：

用 CodeBuddy 内置的 cad-viewer skill 来读取DWG文件。

写一个 CadEngine 类：

1. extract_frame_info(dwg_path)：
   - 读取DWG中图框区域的文字（通常在图纸边缘）
   - 提取：项目名称、图纸名称、图号、日期、比例
   - 返回结构化字典

2. extract_signage_blocks(dwg_path)：
   - 识别标识相关的图块（以特定前缀或图层命名的block）
   - 返回图块名称、图层、插入点坐标列表

3. list_layers(dwg_path)：
   - 返回所有图层名称、是否可见、是否锁定
```

### 任务 5.2：图框文字替换（只读预览）

| 项目 | 内容 |
|------|------|
| **目标** | 预览图框替换效果（不实际写入） |
| **文件** | `backend/api/cad.py` |

**给CodeBuddy的指令：**

```
在 E:\曹铭睿\标识agent\signage-app\backend\api\cad.py 中：

1. POST /api/cad/preview：
   - 上传DWG文件 + 新项目信息
   - 返回图框中会被替换的文字对照表（旧→新）
   - 不实际修改文件

2. POST /api/cad/replace（Phase 5.5才实现）：
   - 上传DWG + 替换映射表
   - 先备份原文件到 backups/
   - 批量替换图框文字
   - 返回替换统计（修改了N处）
```

---

## Phase 6：打包发布

> 目标：生成一个 exe 安装包，双击就能用，不需要装Python和Node。

### 任务 6.1：前端构建

**给CodeBuddy的指令：**

```
在 E:\曹铭睿\标识agent\signage-app\frontend 执行 npm run build，
将 dist 目录的内容作为前端静态文件。
修改后端 main.py 让它同时 serve 静态文件：
- 开发模式（reload=True）：前后端分开跑
- 生产模式：后端直接 serve frontend/dist 下的文件
```

### 任务 6.2：打包

**给CodeBuddy的指令：**

```
帮我把 E:\曹铭睿\标识agent\signage-app 打包成一个Windows桌面应用：

1. 用 PyInstaller 把后端打包成单个 exe
2. 把前端 dist 目录嵌入到 exe 中
3. 启动时自动打开浏览器
4. 不需要用户安装 Python 或 Node

或者如果你觉得 PyInstaller 太复杂，
用一个简单方案：写一个 install.bat，
自动检查环境、创建venv、安装依赖、创建桌面快捷方式。
```

---

## 开发协作规范

### 每次写代码前

1. 描述清楚要做什么（一个页面？一个API？一个函数？）
2. 告诉CodeBuddy文件路径、技术栈、具体要求
3. 小步快跑——一个任务控制在30分钟内能测试

### 每次改完代码后

1. 重启后端（改了Python就重启）
2. 刷新前端页面（改了JSX就刷新）
3. 测试功能——能用就算通过

### 出问题怎么办

| 现象 | 可能原因 | 排查 |
|------|----------|------|
| 白屏 | 后端没启动 | 打开 http://localhost:8765/api/health 看有没有返回 |
| 白屏 | 前端JS报错 | F12打开控制台看红色报错 |
| 按钮点了没反应 | API返回错了 | F12 → Network标签 → 看请求返回什么 |
| 数据没保存 | JSON文件路径错了 | 检查 backend/data/ 目录有没有 projects_index.json |
| start.bat 闪退 | 语法错误 | 右键 start.bat → 编辑，检查路径是否写对 |

---

## 给CodeBuddy的通用指令模板

每开始一个新任务，复制这个模板，填好信息后发给 CodeBuddy：

```
你是资深开发工程师。现在帮我完成标识Agent项目的以下任务：

【任务】
[写清楚要做什么，一个明确的功能]

【文件位置】
- 项目目录：E:\曹铭睿\标识agent\signage-app
- 后端代码：backend/ 目录，Python FastAPI
- 前端代码：frontend/src/ 目录，React + Vite

【具体要求】
[具体的技术要求、输入输出格式、边界条件]

【验收标准】
[怎么算做完——写一条可以验证的标准]
```

---

> 这份路线图会随项目推进持续更新。每个Phase完成后，在这份文档末尾追加完成记录和遇到的问题。
