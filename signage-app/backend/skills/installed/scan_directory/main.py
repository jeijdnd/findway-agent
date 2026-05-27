"""扫描目录技能"""
import os
from typing import Any, Dict

from backend.engine.scanner import DirectoryScanner
from backend.skills.base import BaseSkill


class ScanDirectorySkill(BaseSkill):
    name = "scan_directory"
    description = "扫描本地目录，列出所有子文件夹和项目"
    parameters = {
        "path": {"type": "string", "description": "要扫描的目录路径"},
    }

    async def execute(self, **kwargs) -> Dict[str, Any]:
        path = (kwargs.get("path") or "").strip()
        if not path:
            return {"success": False, "error": "缺少参数 path"}
        if not os.path.isdir(path):
            return {"success": False, "error": f"目录不存在: {path}"}
        scanner = DirectoryScanner()
        result = scanner.scan(path, max_depth=kwargs.get("max_depth", 3))
        return {
            "success": True,
            "path": path,
            "count": result.get("count", 0),
            "projects": result.get("projects", []),
        }


skill = ScanDirectorySkill()
