## Cursor: 迭代3续 — Skills 系统 + 项目级记忆

@PROGRESS_BOARD.md

当前状态：Task 1（Agent架构升级）已完成。Tasks 2+3 从零搭建。

---

### 任务2: Skills 系统

#### 目录结构
```
backend/skills/
├── __init__.py       — 自动加载所有技能，生成工具提示词
├── base.py           — BaseSkill 基类
├── manager.py        — SkillManager（加载/启用/禁用/生成提示词）
├── installed/        — 已安装技能
│   ├── scan_directory/
│   │   ├── skill.json
│   │   └── main.py
│   ├── create_project/
│   │   ├── skill.json
│   │   └── main.py
│   └── compare_list/
│       ├── skill.json
│       └── main.py
└── enabled.json      — {"enabled": ["scan_directory", "create_project"]}
```

#### skill.json 格式
```json
{
  "name": "scan_directory",
  "version": "1.0.0",
  "description": "扫描本地目录，列出所有子文件夹和项目",
  "icon": "folder",
  "category": "文件管理",
  "entry": "main.py",
  "parameters": {
    "path": {"type": "string", "description": "要扫描的目录路径"}
  }
}
```

#### BaseSkill 基类
```python
class BaseSkill:
    name: str
    description: str
    parameters: dict

    async def execute(self, **kwargs) -> dict:
        raise NotImplementedError
```

#### SkillManager
- `load_all()` — 扫描 installed/ 加载所有技能
- `get_enabled()` — 读 enabled.json 获取启用列表
- `get_tools_prompt()` — 生成 LLM System Prompt 的工具描述
- `set_enabled(name, bool)` — 更新启用状态

#### API: backend/api/skills.py
- `GET /api/skills` — 列出所有已安装技能及启用状态
- `POST /api/skills/{name}/toggle` — 启用/禁用
- `GET /api/skills/discover` — 返回 GitHub 搜索链接（先 mock 3-5 个示例）

### 任务3: 项目级记忆

#### 目录结构
```
%APPDATA%/FindWay-Agent/
├── projects/
│   ├── {project_name}/
│   │   ├── chat.json    — 该项目所有对话
│   │   ├── memory.md    — 关键决策/状态摘要
│   │   └── ...
│   └── general/         — 无项目关联的对话
│       ├── chat.json
│       └── memory.md
```

#### 逻辑
- 创建对话时指定 project_id → 自动创建项目目录
- 每次 LLM 请求加载：system_prompt + memory.md + 最近 5 轮
- 回复后异步调用 summarize 技能 → 更新 memory.md

#### summarize_memory Skill（内建）
- 提取新对话中的关键决策、设计变更、客户确认等
- 格式：
  ```markdown
  ## 关键决策
  - 2026-05-27: 确定采用不锈钢材质
  
  ## 当前阶段
  施工图设计中
  
  ## 待办
  - [ ] 清单V2生成
  ```

### 3. 前端设置页更新
- 左侧导航新增「技能」标签
- 列出已安装技能，开关控制启用/禁用
- 显示技能名称、描述、分类

### 约束
- 不改扫描/聊天等现有功能
- skill.json 用中文描述
- 前端 dist 重新构建

完成后 git push。
