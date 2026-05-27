"""创建项目技能"""
from typing import Any, Dict

from backend.skills.base import BaseSkill


class CreateProjectSkill(BaseSkill):
    name = "create_project"
    description = "创建新的标识设计项目"
    parameters = {
        "name": {"type": "string", "description": "项目名称"},
        "project_type": {"type": "string", "description": "项目类型"},
    }

    async def execute(self, **kwargs) -> Dict[str, Any]:
        name = (kwargs.get("name") or "").strip()
        if not name:
            return {
                "success": True,
                "action": "create_project",
                "message": "请在对话中说明项目名称，将打开项目创建面板",
            }
        return {
            "success": True,
            "action": "create_project",
            "suggested_name": name,
            "project_type": kwargs.get("project_type") or "",
        }


skill = CreateProjectSkill()
