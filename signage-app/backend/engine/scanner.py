"""
目录扫描引擎
递归发现本地项目文件夹（只读，不修改被扫描文件）
"""
import os
from typing import Dict, List, Any, Optional


class DirectoryScanner:
    """递归扫描根目录，自动发现含 Excel 清单的项目文件夹"""

    def _list_xlsx_files(self, dir_path: str) -> List[str]:
        """列出目录内有效 .xlsx 文件（排除 ~$ 临时文件）"""
        try:
            names = os.listdir(dir_path)
        except (OSError, PermissionError):
            return []
        files = []
        for name in names:
            if name.startswith("~$"):
                continue
            if not name.lower().endswith(".xlsx"):
                continue
            full = os.path.join(dir_path, name)
            if os.path.isfile(full):
                files.append(full)
        return files

    def is_project_dir(self, dir_path: str) -> bool:
        """判断是否是一个项目目录（含 .xlsx 且非临时文件）"""
        return len(self._list_xlsx_files(dir_path)) > 0

    def _make_project_entry(self, dir_path: str) -> Dict[str, Any]:
        xlsx_files = self._list_xlsx_files(dir_path)
        return {
            "name": os.path.basename(dir_path) or dir_path,
            "path": os.path.normpath(dir_path),
            "file_count": len(xlsx_files),
        }

    def _collect_projects(
        self,
        dir_path: str,
        projects: List[Dict[str, Any]],
        current_depth: int,
        max_depth: Optional[int],
    ) -> None:
        if max_depth is not None and current_depth > max_depth:
            return

        if self.is_project_dir(dir_path):
            projects.append(self._make_project_entry(dir_path))
            return

        if max_depth is not None and current_depth >= max_depth:
            return

        try:
            with os.scandir(dir_path) as entries:
                for entry in entries:
                    if entry.is_dir(follow_symlinks=False):
                        self._collect_projects(
                            entry.path, projects, current_depth + 1, max_depth
                        )
        except (OSError, PermissionError):
            pass

    def scan(self, root_path: str, max_depth: Optional[int] = None) -> dict:
        """递归扫描根目录，发现项目文件夹"""
        root_path = os.path.normpath(root_path)
        if not os.path.isdir(root_path):
            return {"projects": [], "root_path": root_path, "count": 0, "error": "目录不存在或不可访问"}

        projects: List[Dict[str, Any]] = []
        self._collect_projects(root_path, projects, current_depth=0, max_depth=max_depth)
        return {
            "projects": projects,
            "root_path": root_path,
            "count": len(projects),
        }

    def quick_scan(self, root_path: str, depth: int = 2) -> dict:
        """浅层快速扫描（限定 depth 层子目录）"""
        result = self.scan(root_path, max_depth=max_depth)
        result["quick"] = True
        result["depth"] = depth
        return result
