"""GitHub 技能发现"""
from typing import Any, Dict

from backend.skills.base import BaseSkill
from backend.services.github_skill_discovery import search_skills


class DiscoverToolsSkill(BaseSkill):
    name = "discover_tools"
    description = "在 GitHub 搜索 findway-skill 社区技能"
    parameters = {
        "query": {"type": "string", "description": "任务描述或能力关键词"},
    }

    async def execute(self, query: str = "") -> Dict[str, Any]:
        q = (query or "").strip()
        if not q:
            return {
                "success": False,
                "error": "请提供搜索关键词（任务描述）",
            }
        result = search_skills(q)
        return {
            "success": True,
            "found": result.get("found", False),
            "repos": result.get("repos", []),
            "query": q,
            "total_count": result.get("total_count", 0),
            "message": (
                f"找到 {len(result.get('repos', []))} 个候选技能"
                if result.get("found")
                else "未找到匹配的社区技能，可尝试更换关键词"
            ),
        }


skill = DiscoverToolsSkill()
