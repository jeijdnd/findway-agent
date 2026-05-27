"""
技能基类
"""
from typing import Any, Dict


class BaseSkill:
    """所有已安装技能的基类"""

    name: str = ""
    description: str = ""
    parameters: Dict[str, Any] = {}

    async def execute(self, **kwargs) -> Dict[str, Any]:
        raise NotImplementedError(f"技能 {self.name} 未实现 execute 方法")
