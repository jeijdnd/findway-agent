## Cursor: 迭代 3 — 对话记忆 + 命令面板

@PROGRESS_BOARD.md

开始迭代3：先做 P0 的前两个功能。P0-3（布局改造）放下一轮。

---

### P0-1: 对话记忆持久化

**后端**: `backend/api/chat_history.py`
- `GET /api/chat/history` — 返回最近 50 条对话的列表（`[{id, title, preview, updated_at}]`）
- `GET /api/chat/history/<id>` — 返回指定对话的全部消息
- `POST /api/chat/history` — 保存或更新对话
- `DELETE /api/chat/history/<id>` — 删除对话
- 数据存 `%APPDATA%/FindWay-Agent/chat_history.json`，结构：
  ```json
  [
    {
      "id": "chat_xxx",
      "title": "自动生成或用户命名",
      "messages": [
        {"role": "user", "content": "...", "timestamp": "..."},
        {"role": "assistant", "content": "...", "timestamp": "..."}
      ],
      "created_at": "ISO8601",
      "updated_at": "ISO8601"
    }
  ]
  ```

**Electron**: `main.js` 确保 `%APPDATA%/FindWay-Agent/` 目录存在，preload 暴露路径

**前端**:
- `/api/chat` 发送消息后，后端自动保存到历史
- 页面加载时自动加载最近对话列表
- 左侧显示历史列表，点击加载该对话
- + 按钮新建对话

### P0-2: 命令面板 (Ctrl+K)

**前端**:
- `frontend/src/components/CommandPalette.jsx`
- 快捷键 `Ctrl+K` 打开，`Escape` 关闭
- 模糊搜索，匹配以下操作：
  - "扫描文件" → 触发文件扫描
  - "生成清单" → 跳转清单页
  - "新建项目" → 打开新建项目
  - "打开设置" → 跳转设置
  - "新建对话" → Ctrl+N
- 输入框 + 匹配列表，类似 VS Code 命令面板
- 可以整合到现有 WorkBuddyLayout 中

### 约束
- 不要删除现有功能
- 对话数据存 `%APPDATA%/FindWay-Agent/`，不存项目目录
- 完成 git push
