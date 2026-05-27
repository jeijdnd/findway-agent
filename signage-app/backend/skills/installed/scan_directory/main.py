"""扫描目录技能 — 列出子目录（后端直接执行，供 Function Calling 回传真实结果）"""
import os
from typing import Any, Dict

from backend.engine.scanner import DirectoryScanner
from backend.skills.base import BaseSkill


class ScanDirectorySkill(BaseSkill):
    name = "scan_directory"
    description = "扫描本地目录，列出所有子文件夹及含 Excel 的项目文件夹"
    parameters = {
        "path": {"type": "string", "description": "要扫描的目录路径"},
        "max_depth": {"type": "integer", "description": "递归深度，默认 3"},
    }

    async def execute(self, **kwargs) -> Dict[str, Any]:
        path = (kwargs.get("path") or "").strip()
        if not path:
            return {"success": False, "error": "缺少参数 path"}
        if not os.path.isdir(path):
            return {"success": False, "error": f"目录不存在或不可访问: {path}"}

        max_depth = kwargs.get("max_depth", 3)
        try:
            max_depth = int(max_depth)
        except (TypeError, ValueError):
            max_depth = 3

        scanner = DirectoryScanner()
        result = scanner.list_subdirs(path, max_depth=max_depth)
        if result.get("error"):
            return {"success": False, "error": result["error"]}

        dirs = result.get("dirs") or []
        return {
            "success": True,
            "root_path": result.get("root_path", path),
            "count": len(dirs),
            "project_count": sum(1 for d in dirs if d.get("is_project")),
            "dirs": dirs,
        }


skill = ScanDirectorySkill()
