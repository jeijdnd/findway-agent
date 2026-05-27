"""清单对比技能"""
from typing import Any, Dict

from backend.skills.base import BaseSkill


class CompareListSkill(BaseSkill):
    name = "compare_list"
    description = "对比两版清单差异"
    parameters = {
        "file_a": {"type": "string", "description": "清单文件 A"},
        "file_b": {"type": "string", "description": "清单文件 B"},
    }

    async def execute(self, **kwargs) -> Dict[str, Any]:
        return {
            "success": True,
            "action": "compare_list",
            "message": "将打开清单对比页面，请上传或选择两版清单文件",
            "file_a": kwargs.get("file_a"),
            "file_b": kwargs.get("file_b"),
        }


skill = CompareListSkill()
