"""创建项目技能"""
from typing import Any, Dict

from backend.skills.base import BaseSkill


class CreateProjectSkill(BaseSkill):
    name = "create_project"
    description = "创建项目并添加到项目仪表盘中"
    parameters = {
        "name": {"type": "string", "description": "项目名称"},
        "path": {"type": "string", "description": "项目目录路径"},
        "project_type": {"type": "string", "description": "项目类型"},
    }

    async def execute(self, **kwargs) -> Dict[str, Any]:
        name = (kwargs.get("name") or "").strip()
        path = (kwargs.get("path") or "").strip()
        project_type = (kwargs.get("project_type") or "").strip()

        if not name:
            return {
                "success": True,
                "action": "create_project",
                "message": "请在对话中说明项目名称，将打开项目创建面板",
                "path": path,
            }

        payload: Dict[str, Any] = {
            "success": True,
            "action": "create_project",
            "project_name": name,
            "suggested_name": name,
            "path": path,
            "project_type": project_type,
        }
        return payload


skill = CreateProjectSkill()
