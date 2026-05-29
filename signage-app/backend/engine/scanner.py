"""
目录扫描引擎
递归发现本地项目文件夹（只读，不修改被扫描文件）
"""
import os
from typing import Dict, List, Any, Optional


class DirectoryScanner:
    """递归扫描根目录，自动发现含 Excel 清单的项目文件夹"""

    SKIP_DIR_NAMES = frozenset({
        ".git",
        "node_modules",
        "__pycache__",
        ".venv",
        "venv",
        ".idea",
        ".vscode",
        "dist",
        "build",
        ".cursor",
        ".svn",
        ".hg",
        "Thumbs.db",
    })

    def _should_skip_dir(self, name: str) -> bool:
        return name in self.SKIP_DIR_NAMES

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
        result = self.scan(root_path, max_depth=depth)
        result["quick"] = True
        result["depth"] = depth
        return result

    def _count_direct_files(self, dir_path: str) -> int:
        """统计目录下直接子文件数量（不含子目录内文件）"""
        try:
            count = 0
            for name in os.listdir(dir_path):
                if name.startswith("."):
                    continue
                if os.path.isfile(os.path.join(dir_path, name)):
                    count += 1
            return count
        except (OSError, PermissionError):
            return 0

    def _collect_subdirs(
        self,
        dir_path: str,
        dirs: List[Dict[str, Any]],
        current_depth: int,
        max_depth: int,
    ) -> None:
        """递归收集所有子目录（不因含 .xlsx 而提前终止）"""
        if current_depth > max_depth:
            return

        norm_path = os.path.normpath(dir_path)
        is_project = self.is_project_dir(norm_path)
        xlsx_files = self._list_xlsx_files(norm_path) if is_project else []

        dirs.append({
            "name": os.path.basename(norm_path) or norm_path,
            "path": norm_path,
            "depth": current_depth,
            "is_project": is_project,
            "file_count": len(xlsx_files) if is_project else self._count_direct_files(norm_path),
        })

        if current_depth >= max_depth:
            return

        try:
            with os.scandir(dir_path) as entries:
                for entry in entries:
                    if not entry.is_dir(follow_symlinks=False):
                        continue
                    if self._should_skip_dir(entry.name):
                        continue
                    self._collect_subdirs(
                        entry.path, dirs, current_depth + 1, max_depth
                    )
        except (OSError, PermissionError):
            pass

    def list_subdirs(self, root_path: str, max_depth: int = 3) -> dict:
        """列出 root_path 下所有子目录（含层级），不要求含 .xlsx"""
        root_path = os.path.normpath(root_path)
        if not os.path.isdir(root_path):
            return {
                "dirs": [],
                "count": 0,
                "root_path": root_path,
                "error": "目录不存在或不可访问",
            }

        dirs: List[Dict[str, Any]] = []
        self._collect_subdirs(root_path, dirs, current_depth=0, max_depth=max_depth)
        return {
            "dirs": dirs,
            "count": len(dirs),
            "root_path": root_path,
        }

    def _count_files_recursive(self, dir_path: str) -> int:
        """统计目录下所有文件数量（含子目录）"""
        count = 0
        try:
            for root, dirs, files in os.walk(dir_path):
                dirs[:] = [
                    d for d in dirs
                    if not d.startswith(".") and not self._should_skip_dir(d)
                ]
                for name in files:
                    if not name.startswith("."):
                        count += 1
        except (OSError, PermissionError):
            pass
        return count

    def scan_folder(self, root_path: str) -> dict:
        """扫描根目录第一层文件夹，作为项目列表"""
        root_path = os.path.normpath(root_path)
        if not os.path.isdir(root_path):
            return {
                "folders": [],
                "root_path": root_path,
                "count": 0,
                "error": "目录不存在或不可访问",
            }

        folders: List[Dict[str, Any]] = []
        try:
            with os.scandir(root_path) as entries:
                for entry in entries:
                    if not entry.is_dir(follow_symlinks=False):
                        continue
                    if self._should_skip_dir(entry.name) or entry.name.startswith("."):
                        continue
                    norm_path = os.path.normpath(entry.path)
                    folders.append({
                        "name": entry.name,
                        "path": norm_path,
                        "file_count": self._count_files_recursive(norm_path),
                    })
        except (OSError, PermissionError) as exc:
            return {
                "folders": [],
                "root_path": root_path,
                "count": 0,
                "error": str(exc),
            }

        folders.sort(key=lambda item: item["name"].lower())
        return {
            "folders": folders,
            "root_path": root_path,
            "count": len(folders),
        }

    def browse(self, dir_path: str) -> dict:
        """列出指定文件夹内的直接子文件夹和文件"""
        dir_path = os.path.normpath(dir_path)
        if not os.path.isdir(dir_path):
            return {
                "folders": [],
                "files": [],
                "path": dir_path,
                "error": "目录不存在或不可访问",
            }

        folders: List[Dict[str, Any]] = []
        files: List[Dict[str, Any]] = []
        try:
            with os.scandir(dir_path) as entries:
                for entry in entries:
                    if entry.name.startswith("."):
                        continue
                    if entry.is_dir(follow_symlinks=False):
                        if self._should_skip_dir(entry.name):
                            continue
                        norm_path = os.path.normpath(entry.path)
                        folders.append({
                            "name": entry.name,
                            "path": norm_path,
                            "file_count": self._count_files_recursive(norm_path),
                        })
                    elif entry.is_file(follow_symlinks=False):
                        norm_path = os.path.normpath(entry.path)
                        try:
                            size = entry.stat(follow_symlinks=False).st_size
                        except OSError:
                            size = 0
                        files.append({
                            "name": entry.name,
                            "path": norm_path,
                            "size": size,
                        })
        except (OSError, PermissionError) as exc:
            return {
                "folders": [],
                "files": [],
                "path": dir_path,
                "error": str(exc),
            }

        folders.sort(key=lambda item: item["name"].lower())
        files.sort(key=lambda item: item["name"].lower())
        return {
            "folders": folders,
            "files": files,
            "path": dir_path,
        }
