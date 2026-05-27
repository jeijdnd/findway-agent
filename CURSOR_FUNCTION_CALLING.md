## Cursor: 核心架构升级 — Function Calling

@PROGRESS_BOARD.md

### 背景
目前意图判断靠 infer_intent() + 正则兜底，路径提取靠正则，工具执行靠前端来回传。
所有主流 Agent 用 Function Calling 一次性解决这三个问题。

### 改动

#### 1. llm_engine.py — 全面改用 Function Calling

现有的 `chat()` / `chat_stream()` 方法改为：

```python
# 构建 tools 列表（从 Skills 系统动态生成）
tools = []
for name, skill in skill_manager.get_enabled_skills().items():
    tools.append({
        "type": "function",
        "function": {
            "name": name,
            "description": skill.skill_json["description"],
            "parameters": {
                "type": "object",
                "properties": {
                    k: v for k, v in skill.parameters.items()
                },
                "required": list(skill.parameters.keys())
            }
        }
    })

# 调用 LLM
response = await client.chat.completions.create(
    model=model_name,
    messages=messages,
    tools=tools  # ← 动态传入
)
```

#### 2. chat.py — 处理后端执行 + 结果回传

LLM 返回 `response.choices[0].message.tool_calls` 时：

```python
if message.tool_calls:
    for tool_call in message.tool_calls:
        name = tool_call.function.name
        args = json.loads(tool_call.function.arguments)
        
        # 在后端直接执行工具
        skill = skill_manager.get_skill(name)
        result = await skill.execute(**args)
        
        # 把结果追加到对话
        messages.append({
            "role": "tool",
            "tool_call_id": tool_call.id,
            "content": json.dumps(result, ensure_ascii=False)
        })
    
    # 再调一次 LLM，让它用结果组织回答
    final_response = await client.chat.completions.create(
        model=model_name,
        messages=messages,
    )
    reply = final_response.choices[0].message.content
```

#### 3. 前端 ChatPanel 简化

- 不再需要处理 `action: "scan_directory"` 的确认逻辑
- 权限确认改为：LLM 返回 `execute` → 前端弹窗 → 用户确认 → 后端才真正执行
- 或者：权限确认在后端统一处理，前端只显示结果
- 删除 `formatScanResultForLlm()`、`requestLlmScanSummary()` 等临时方案

### 改哪些文件
- `backend/services/llm_engine.py` — 核心改 Function Calling
- `backend/api/chat.py` — 处理后端执行 + 结果回传
- `frontend/src/components/ChatPanel.jsx` — 简化，删掉扫描回传临时逻辑
- 其他 `chat_permissions.py` 相关可删可保留（暂保留不删）

### 不动的
- Skills 系统（`skills/` 目录）
- 项目级记忆（`project_memory.py`）
- 文件权限（`scanner.py`）
- 日志面板
- 命令面板

### 效果
| 现在 | 改后 |
|------|------|
| 正则抠路径 → 容易错 | LLM 自己填参数 → 准确 |
| 意图 if/else → 死板 | Function Calling → 灵活 |
| 前端来回传 → 复杂 | 后端闭环 → 简单 |
| 结果不回传 → 幻觉 | 结果回传 → 准确 |

完成后 git push。
