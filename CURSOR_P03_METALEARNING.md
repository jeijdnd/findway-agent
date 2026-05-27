## Cursor: P3 — 工具自发现（Meta-Learning）

@PROGRESS_BOARD.md

### 需求
用户说"帮我处理CAD文件" → LLM 发现自己没有 read_cad 工具 → 搜 GitHub → 评估安全 → 问用户是否安装 → 安装后执行。

### 实现

#### 1. 新增 Skill：discover_tools
`backend/skills/installed/discover_tools/`
- skill.json：名称 discover_tools，分类 "系统"
- main.py：调用 GitHub API 搜索 repos
- 关键词：topic:findway-skill + 用户的任务描述
- 评估安全：星数 ≥5、有 README、无危险关键词
- 返回推荐列表

#### 2. 后端 API
`POST /api/skills/discover-from-github`
- 输入：{ query: "CAD读取" }
- 输出：{ found: bool, repos: [{name, description, stars, safety_score, install_url}] }

`POST /api/skills/install-from-github`
- 输入：{ repo_url: "https://github.com/..." }
- 克隆到 skills/installed/
- 验签（skill.json 格式正确、依赖安全）
- 返回 { success: bool, skill_name: "..." }

#### 3. LLM 集成
当 Function Calling 循环中，LLM 发现需求但无对应工具时：
- 追加 tool 结果：{ no_tool_found: true, suggest: "建议搜索 GitHub" }
- 触发前端展示 "正在搜索适合的工具..."

#### 4. 前端
- 发现工具列表卡片（名称、描述、星数、安全评分）
- 「安装」按钮 → 确认弹窗 → 调用安装 API
- 安装完成后自动启用

### 约束
- 只搜 topic:findway-skill 的 GitHub repos
- 安装前必须用户确认
- 安全评分低的显示警告
- 不改现有功能

完成后 git push。
