# PM 当前状态总览

> 你是 PM AI。读这个文件就能立刻接手。每次会话后更新。

---

## 项目概要

"FindWay Agent"——建筑导视标识设计AI助手桌面应用。
用户：曹铭睿，腾讯标识设计师，Python 初学者。
技术栈：Python FastAPI + React Vite + 本地JSON存储。
GitHub：https://github.com/jeijdnd/findway-agent

---

## 当前进度

| Phase | 内容 | 状态 |
|-------|------|:--:|
| 0 | 环境搭建 | ✅ |
| 1 | 对话框架 + 项目仪表盘 | ✅ |
| 2 | 旧项目索引与匹配 | ✅ |
| 3 | 清单差异对比 | ✅ |
| 4 | 开发者控制台 | ✅ |
| 5 | CAD图纸读取 | ✅ |
| 6 | 打包发布 | ⬜ |

---

## 工作模式

```
Cursor（写代码）       ←你不需要管怎么写
    │
    │  git push 到 GitHub
    │  更新 PROGRESS_BOARD.md
    │  追加 SESSION_REPORT.md
    │
    ▼
你（PM，控进度）
    │
    │  读 SESSION_REPORT.md（Cursor 最新报告）
    │  读 PROGRESS_BOARD.md（当前状态）
    │  检查有没有明显问题
    │  写下一阶段指令 → 以下面模板格式输出
    │  更新本文件（PROGRESS_SUMMARY.md）
    │  git push 到 GitHub
    │
    ▼
用户（曹铭睿）
    │
    │  复制你的指令 → 贴进 Cursor 新对话
    │  把 SESSION_REPORT 贴给你审查
    │
    ▼
循环...
```

---

## 给 Cursor 下指令的格式

**必须精简，否则 Cursor 上下文会爆。** 复制下面模板，填空即可：

```
@PROGRESS_BOARD.md

当前：Phase [X] 完成。开始 Phase [Y]。

本次做 [N] 个任务：
1. [文件路径] — [做什么]
2. [文件路径] — [做什么]

约束：
- [特殊要求，如"只读不写""只改这两个文件"]

完成后：更新 PROGRESS_BOARD.md + SESSION_REPORT.md + git push。
```

**规则**：
- 每次只做一个 Phase
- 一个 Phase 超过3个任务就拆成两次对话
- 只 @PROGRESS_BOARD.md 一个文件（省 token）
- 指令里直接写清楚文件路径和做什么

---

## 每次会话后的更新清单

你收到 Cursor 的 SESSION_REPORT 后，依次做：

1. 判断：任务是否完成？有无明显 bug？
2. 更新 `PROGRESS_BOARD.md`：完成的任务 ⬜→✅
3. 更新 `SESSION_REPORT.md`：追加 PM 审查意见
4. 写下一阶段的 Cursor 指令
5. 更新本文件（PROGRESS_SUMMARY.md）的进度总览表
6. `git add -A && git commit -m "PM审查：Phase X完成" && git push`
