"""项目记忆摘要技能（系统内建）"""
from datetime import datetime
from typing import Any, Dict

from backend.skills.base import BaseSkill


class SummarizeMemorySkill(BaseSkill):
    name = "summarize_memory"
    description = "从对话中提取关键决策与待办，更新项目记忆"
    parameters = {}

    async def execute(self, **kwargs) -> Dict[str, Any]:
        from backend.services.llm_engine import llm_engine

        current = (kwargs.get("current_memory") or "").strip()
        user_msg = kwargs.get("user_message") or ""
        assistant_reply = kwargs.get("assistant_reply") or ""
        if not user_msg and not assistant_reply:
            return {"success": False, "error": "无对话内容可摘要"}

        prompt = f"""你是项目记忆整理助手。根据新一轮对话，更新项目 memory.md 摘要。

要求：
1. 保留并合并「关键决策」「当前阶段」「待办」三个章节（Markdown 格式）
2. 新决策加日期前缀，格式：- YYYY-MM-DD: 内容
3. 待办使用 - [ ] / - [x] 格式
4. 去掉重复、过时信息，保持简洁（不超过 80 行）
5. 只输出更新后的完整 Markdown，不要其它说明

当前 memory.md：
```
{current or "（空，请初始化三个章节）"}
```

本轮对话：
用户：{user_msg}
助手：{assistant_reply}
"""

        result = await llm_engine.chat(
            message=prompt,
            history=[],
            api_config_id=kwargs.get("api_config_id"),
            use_tools=False,
        )
        updated = result.reply
        if updated.startswith("错误") or updated.startswith("LLM调用失败"):
            return {"success": False, "error": updated}

        today = datetime.now().strftime("%Y-%m-%d")
        if "## 关键决策" not in updated:
            updated = (
                f"## 关键决策\n\n## 当前阶段\n\n## 待办\n\n"
                f"<!-- 更新于 {today} -->\n\n{updated}"
            )
        return {"success": True, "memory_md": updated.strip()}


skill = SummarizeMemorySkill()
