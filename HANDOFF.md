# PM 交接文档

> 你是项目 PM，我是前任 PM。读这个文件，你就能完全接手。

---

## 你的工作

监督一个叫 Cursor 的 AI 写代码，构建"FindWay Agent"——建筑导视标识设计AI助手。

**你只需要做三件事**：
1. 读 Cursor 交上来的 SESSION_REPORT → 检查有没有问题
2. 更新 PROGRESS_BOARD → 标记完成的任务
3. 给 Cursor 下一阶段指令 → 复制 CURSOR_PHASEX.md 模板改改

---

## 接手时的状态

**首先**：`git pull` 拉取最新代码。

**然后按顺序读**：

| 文件 | 作用 |
|------|------|
| `HANDOFF.md` | 这个文件（只读一次，了解工作模式） |
| `PRD.md` | 软件需求（只读一次） |
| `PROGRESS_BOARD.md` | **当前进度**（每次必读） |
| `SESSION_REPORT.md` | 最近一次做了什么（每次必读） |
| `TECH_DECISIONS.md` | 技术决策（需要时查） |

**HANDOFF.md 本身不需要每次更新**——它是工作模式的说明书。
真正要每次同步的是 `PROGRESS_BOARD.md` 和 `SESSION_REPORT.md`。

---

## 工作模式

```
Cursor（AI写代码）
    │
    │  完成一个Phase
    │  更新 PROGRESS_BOARD.md
    │  追加 SESSION_REPORT.md
    │  git push
    │
    ▼
你（PM）
    │
    │  读 SESSION_REPORT.md
    │  检查代码有没有明显问题
    │  更新 PROGRESS_BOARD.md
    │  写下一阶段的 CURSOR_PHASEX.md
    │  告诉用户：下一步贴什么给 Cursor
    │
    ▼
用户（曹铭睿）
    │
    │  复制你的指令 → 贴进 Cursor 新对话
    │  Cursor 写代码
    │  把 SESSION_REPORT 贴给你审查
    │
    ▼
循环...
```

---

## 给 Cursor 下指令的模板

每次 Cursor 完成一个 Phase，你给下一阶段的指令时，照这个格式写：

```
@PROGRESS_BOARD.md

当前：Phase X 完成。开始 Phase Y。

本次做N个任务：
1. xx
2. xx

约束：[任何特殊要求]

完成后：更新 PROGRESS_BOARD.md + SESSION_REPORT.md + git push。
```

**关键**：指令要短、只@一个文件、明确文件路径和任务数量。否则 Cursor 上下文会爆。

---

## Cursor 上下文管理

Cursor 每次对话有上下文上限。
- 一个 Phase 开一个新对话
- 指令只 @PROGRESS_BOARD.md（最省token）
- 如果一个 Phase 任务超过3个，拆成两次对话

---

## 用户信息

- 曹铭睿，腾讯标识设计师
- Python 初学者，用 Cursor 写代码
- 项目在 `E:\曹铭睿\findway_agent`
- GitHub：https://github.com/jeijdnd/findway-agent
- 另一台电脑可以用 `git clone` 同步
