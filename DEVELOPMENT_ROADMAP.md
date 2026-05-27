# FindWay Agent — 开发看板

> 更新于 2026-05-27 18:00

---

## ✅ 已完成

### V2 基础
| 功能 | 说明 |
|------|------|
| Electron 桌面壳 | 窗口、托盘、IPC |
| LLM 引擎 | 兼容 OpenAI 协议（MiMo/DeepSeek） |
| 兔钉合并引擎 | 布点图合并 |

### 桌面启动（9 Bug 全部修复）
| Bug | 修复方式 |
|-----|---------|
| Bat 编码 | chcp 65001 |
| 缺 electron-store | try-catch |
| 缺 python-multipart | pip install |
| Python import 失败 | PYTHONPATH |
| Health 路由顺序 | 移到 SPA 之前 |
| 超时太短 | 15s→60s + HTTP 检查 |
| Electron 管太多 | 极简重构 |
| 端口残留 | kill 进程 |
| favicon.ico 不存在 | try-catch |

### 迭代 3 — Agent 核心
| 功能 | 提交 |
|------|------|
| Agent 架构升级（LLM 统一判断意图） | 5252022 |
| 对话记忆持久化 | 373b909 |
| 命令面板 Ctrl+K | 373b909 |
| 文件权限弹窗确认 | fe9ecc4 |
| 日志面板（设置→日志） | 8a73f68 |
| 错误自动汇总 | 8a73f68 |
| 扫描器修复（全子目录） | ec63f4c |
| Skills 系统（manager + 设置页开关） | 882f013 |
| 项目级记忆（memory.md + 自动摘要） | 882f013 |
| 扫描幻觉修复（结果回传 LLM） | ae455a5 |

---

## 🔄 当前任务

| 优先级 | 任务 | 文件 | 状态 |
|--------|------|------|------|
| **P0** | **Function Calling 重构** | CURSOR_FUNCTION_CALLING.md | ⏳ 待开始 |
| P0-3 | 右侧按钮条 + 侧滑面板 | — | 待排期 |

## 📋 后续需求

| 优先级 | 任务 | 说明 |
|--------|------|------|
| P2 | 渐进式权限（只读记住） | 减少弹窗 |
| P3 | 工具自发现（Meta-Learning） | 搜索 GitHub + 用户确认安装 |
| P3 | 安全沙箱（Dual Agent） | 执行 Agent + 审核 Agent |
| P3 | Skill Hub 连 GitHub | 社区 Skills 市场 |
| P3 | P0-3 布局改造 | 右侧按钮条+侧滑面板占1/3 |
