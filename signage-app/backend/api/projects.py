"""
项目管理 API — 全生命周期管理器
数据存储在 %APPDATA%/FindWay-Agent/projects/
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import json
import os
import uuid
import shutil
from datetime import datetime

from backend.services.app_data import (
    get_projects_index_path,
    get_default_project_path,
    DEFAULT_PROJECT_ROOT,
)
from backend.engine.scanner import DirectoryScanner
from backend.api.scanner import _check_permission

router = APIRouter()
_scanner = DirectoryScanner()

STAGES = [
    "概念方案",
    "方案设计",
    "施工图",
    "审图",
    "清单V1",
    "清单V2",
    "竣工图",
    "已交付",
    "暂停",
]

STAGE_GROUPS = {
    "进行中": ["概念方案", "方案设计"],
    "施工阶段": ["施工图", "审图"],
    "清单阶段": ["清单V1", "清单V2"],
    "已完成": ["竣工图", "已交付"],
    "暂停": ["暂停"],
}

GROUP_ICONS = {
    "进行中": "🟡",
    "施工阶段": "🔵",
    "清单阶段": "🟢",
    "已完成": "⚪",
    "暂停": "⏸️",
}

# 旧数据路径（迁移用）
_LEGACY_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "projects_index.json")


class ProjectFile(BaseModel):
    name: str
    tag: str = ""
    uploaded: str = ""
    modified: str = ""


class ProjectCreate(BaseModel):
    name: str
    year: int
    stage: str = "概念方案"
    path: str = ""


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    year: Optional[int] = None
    stage: Optional[str] = None
    path: Optional[str] = None
    files: Optional[List[ProjectFile]] = None


class ProjectFilesAdd(BaseModel):
    files: List[ProjectFile]


class FileMoveBody(BaseModel):
    source: str
    dest_folder: str = ""
    permission_id: str


class FileMkdirBody(BaseModel):
    folder: str
    permission_id: str


class FileDeleteBody(BaseModel):
    path: str
    permission_id: str


class ImportScanFolder(BaseModel):
    name: str
    path: str


class ImportScanRequest(BaseModel):
    folders: List[ImportScanFolder]


class ProjectResponse(BaseModel):
    """扫描注册等旧接口使用的项目响应模型"""
    id: str
    name: str
    project_type: str = ""
    buildings: List[str] = []
    notes: str = ""
    stage: str = ""
    created_at: str = ""
    updated_at: str = ""


def _stage_group(stage: str) -> str:
    if not stage:
        return "进行中"
    for group, stages in STAGE_GROUPS.items():
        if stage in stages:
            return group
    return "进行中"


def _migrate_legacy():
    """从 backend/data/projects_index.json 迁移到 APPDATA"""
    index_path = get_projects_index_path()
    if os.path.exists(index_path):
        return
    if not os.path.exists(_LEGACY_PATH):
        return
    try:
        with open(_LEGACY_PATH, "r", encoding="utf-8") as f:
            legacy = json.load(f)
        migrated = []
        for p in legacy:
            migrated.append({
                "id": p.get("id", str(uuid.uuid4())),
                "name": p.get("name", ""),
                "year": datetime.now().year,
                "stage": p.get("stage", "概念方案"),
                "path": "",
                "files": [],
                "created_at": p.get("created_at", datetime.now().isoformat()),
                "updated_at": p.get("updated_at", datetime.now().isoformat()),
            })
        save_projects(migrated)
    except Exception:
        pass


def load_projects() -> List[dict]:
    _migrate_legacy()
    index_path = get_projects_index_path()
    try:
        if os.path.exists(index_path):
            with open(index_path, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception:
        pass
    return []


def save_projects(projects: List[dict]):
    index_path = get_projects_index_path()
    os.makedirs(os.path.dirname(index_path), exist_ok=True)
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(projects, f, ensure_ascii=False, indent=2)


def _resolve_project_path(name: str, custom_path: str = "") -> str:
    if custom_path.strip():
        return os.path.normpath(custom_path.strip())
    root = get_default_project_path()
    return os.path.normpath(os.path.join(root, name))


def _scan_disk_files(project_path: str) -> List[dict]:
    """递归扫描项目文件夹，返回文件列表（相对路径 + 修改日期）"""
    project_path = os.path.normpath(project_path)
    files: List[dict] = []
    try:
        for root, dirs, filenames in os.walk(project_path):
            dirs[:] = [
                d for d in dirs
                if not d.startswith(".") and not _scanner._should_skip_dir(d)
            ]
            for name in filenames:
                if name.startswith(".") or name.startswith("~$"):
                    continue
                full = os.path.join(root, name)
                if not os.path.isfile(full):
                    continue
                rel = os.path.relpath(full, project_path).replace("\\", "/")
                try:
                    mtime = datetime.fromtimestamp(os.path.getmtime(full)).strftime("%Y-%m-%d")
                except OSError:
                    mtime = ""
                files.append({
                    "name": rel,
                    "tag": "",
                    "uploaded": "",
                    "modified": mtime,
                })
    except (OSError, PermissionError):
        pass
    files.sort(key=lambda item: item["name"].lower())
    return files


def _scan_disk_dirs(project_path: str) -> List[str]:
    """递归扫描项目文件夹，返回相对路径目录列表（含空文件夹）"""
    project_path = os.path.normpath(project_path)
    dirs: List[str] = []
    try:
        for root, dirnames, _ in os.walk(project_path):
            dirnames[:] = [
                d for d in dirnames
                if not d.startswith(".") and not _scanner._should_skip_dir(d)
            ]
            for name in dirnames:
                full = os.path.join(root, name)
                rel = os.path.relpath(full, project_path).replace("\\", "/")
                dirs.append(rel)
    except (OSError, PermissionError):
        pass
    dirs.sort(key=str.lower)
    return dirs


def _merge_project_files(stored_files: List[dict], disk_files: List[dict]) -> List[dict]:
    """合并磁盘扫描结果与索引中用户维护的标签/上传日期"""
    stored_by_name = {f.get("name"): f for f in (stored_files or []) if f.get("name")}
    merged: List[dict] = []
    seen = set()
    for disk_file in disk_files:
        name = disk_file["name"]
        seen.add(name)
        stored = stored_by_name.get(name, {})
        merged.append({
            "name": name,
            "tag": stored.get("tag", ""),
            "uploaded": stored.get("uploaded", ""),
            "modified": disk_file.get("modified") or stored.get("modified", ""),
        })
    for name, stored in stored_by_name.items():
        if name not in seen:
            merged.append(stored)
    return merged


def _enrich_project(project: dict) -> dict:
    """从项目路径扫描实际文件，填充 files 列表供前端展示"""
    path = (project.get("path") or "").strip()
    if not path or not os.path.isdir(path):
        return project
    enriched = dict(project)
    enriched["files"] = _merge_project_files(
        project.get("files") or [],
        _scan_disk_files(path),
    )
    enriched["folders"] = _scan_disk_dirs(path)
    return enriched


def _enrich_projects(projects: List[dict]) -> List[dict]:
    return [_enrich_project(p) for p in projects]


def _norm_rel_path(path: str) -> str:
    return path.replace("\\", "/").strip().strip("/")


def _find_project(projects: List[dict], project_id: str) -> tuple:
    for i, p in enumerate(projects):
        if p["id"] == project_id:
            return i, p
    return -1, None


def _require_project_write(project: dict, permission_id: str) -> str:
    project_path = (project.get("path") or "").strip()
    if not project_path or not os.path.isdir(project_path):
        raise HTTPException(status_code=400, detail="项目路径无效或不存在")
    if not permission_id:
        raise HTTPException(status_code=403, detail="未获得用户授权，操作已取消。请先确认权限。")
    if not _check_permission(permission_id, project_path, "write"):
        raise HTTPException(status_code=403, detail="未获得用户授权或授权已过期，操作已取消。")
    return os.path.normpath(project_path)


def _rel_to_abs(project_path: str, rel_path: str) -> str:
    rel = _norm_rel_path(rel_path)
    if not rel:
        return project_path
    return os.path.normpath(os.path.join(project_path, rel.replace("/", os.sep)))


def _update_paths_after_move(files: List[dict], source: str, dest_folder: str) -> List[dict]:
    source = _norm_rel_path(source)
    dest_folder = _norm_rel_path(dest_folder)
    basename = source.rsplit("/", 1)[-1]
    new_prefix = f"{dest_folder}/{basename}" if dest_folder else basename
    updated = []
    for f in files:
        name = _norm_rel_path(f.get("name", ""))
        if not name:
            updated.append(f)
            continue
        if name == source:
            updated.append({**f, "name": new_prefix})
        elif name.startswith(source + "/"):
            updated.append({**f, "name": new_prefix + name[len(source):]})
        else:
            updated.append(f)
    return updated


def _remove_paths_from_index(files: List[dict], target: str) -> List[dict]:
    target = _norm_rel_path(target)
    return [
        f for f in files
        if _norm_rel_path(f.get("name", "")) != target
        and not _norm_rel_path(f.get("name", "")).startswith(target + "/")
    ]


@router.get("/api/projects/stages")
async def get_stages():
    """获取阶段列表与分组信息"""
    return {
        "stages": STAGES,
        "groups": [
            {"name": g, "icon": GROUP_ICONS[g], "stages": STAGE_GROUPS[g]}
            for g in STAGE_GROUPS
        ],
    }


@router.get("/api/projects")
async def list_projects():
    """获取所有项目，按阶段分组（含磁盘文件扫描）"""
    projects = _enrich_projects(load_projects())
    grouped = {g: [] for g in STAGE_GROUPS}
    for p in projects:
        group = _stage_group(p.get("stage", "概念方案"))
        grouped[group].append(p)
    return {
        "projects": projects,
        "grouped": grouped,
        "groups": [
            {"name": g, "icon": GROUP_ICONS[g], "stages": STAGE_GROUPS[g]}
            for g in STAGE_GROUPS
        ],
    }


@router.post("/api/projects")
async def create_project(project: ProjectCreate):
    """创建新项目"""
    if not project.name.strip():
        raise HTTPException(status_code=400, detail="项目名称不能为空")
    if project.stage not in STAGES:
        raise HTTPException(status_code=400, detail=f"无效阶段: {project.stage}")

    projects = load_projects()
    for p in projects:
        if p["name"] == project.name.strip():
            raise HTTPException(status_code=400, detail="项目名称已存在")

    now = datetime.now().isoformat()
    project_path = _resolve_project_path(project.name.strip(), project.path)

    try:
        os.makedirs(project_path, exist_ok=True)
    except OSError as e:
        raise HTTPException(status_code=400, detail=f"无法创建项目目录: {e}")

    new_project = {
        "id": str(uuid.uuid4()),
        "name": project.name.strip(),
        "year": project.year,
        "stage": project.stage,
        "path": project_path,
        "files": [],
        "created_at": now,
        "updated_at": now,
    }
    projects.append(new_project)
    save_projects(projects)
    return _enrich_project(new_project)


@router.get("/api/projects/search")
async def search_projects(
    name: Optional[str] = None,
    year: Optional[int] = None,
    stage: Optional[str] = None,
):
    """按名称、年份、阶段筛选项目（聊天联动接口）"""
    projects = _enrich_projects(load_projects())
    query = (name or "").strip().lower()
    filtered = []
    for p in projects:
        if query and query not in p.get("name", "").lower():
            continue
        if year is not None and p.get("year") != year:
            continue
        if stage and p.get("stage") != stage:
            continue
        filtered.append(p)
    return {"projects": filtered, "count": len(filtered)}


@router.post("/api/projects/import-scan")
async def import_from_scan(body: ImportScanRequest):
    """批量导入扫描到的文件夹为项目，已存在的跳过"""
    projects = load_projects()
    existing_names = {p["name"] for p in projects}
    existing_paths = {os.path.normpath(p.get("path", "")) for p in projects if p.get("path")}
    added = []
    skipped = 0
    now = datetime.now().isoformat()

    for folder in body.folders:
        name = folder.name.strip()
        path = os.path.normpath(folder.path.strip())
        if not name or not path:
            continue
        if name in existing_names or path in existing_paths:
            skipped += 1
            continue
        new_project = {
            "id": str(uuid.uuid4()),
            "name": name,
            "year": None,
            "stage": "",
            "path": path,
            "files": [],
            "created_at": now,
            "updated_at": now,
        }
        projects.append(new_project)
        existing_names.add(name)
        existing_paths.add(path)
        added.append(new_project)

    if added:
        save_projects(projects)
    return {
        "added": len(added),
        "skipped": skipped,
        "projects": _enrich_projects(added),
    }


@router.get("/api/projects/{project_id}")
async def get_project(project_id: str):
    """获取单个项目详情"""
    projects = load_projects()
    for p in projects:
        if p["id"] == project_id:
            return _enrich_project(p)
    raise HTTPException(status_code=404, detail="项目不存在")


@router.put("/api/projects/{project_id}")
async def update_project(project_id: str, update: ProjectUpdate):
    """更新项目信息"""
    projects = load_projects()
    for i, p in enumerate(projects):
        if p["id"] == project_id:
            data = update.dict(exclude_unset=True)
            if "stage" in data and data["stage"] and data["stage"] not in STAGES:
                raise HTTPException(status_code=400, detail=f"无效阶段: {data['stage']}")
            if "files" in data:
                data["files"] = [f if isinstance(f, dict) else f.dict() for f in data["files"]]
            data["updated_at"] = datetime.now().isoformat()
            projects[i].update(data)
            save_projects(projects)
            return _enrich_project(projects[i])
    raise HTTPException(status_code=404, detail="项目不存在")


@router.post("/api/projects/{project_id}/files")
async def add_project_files(project_id: str, body: ProjectFilesAdd):
    """向项目添加文件记录（拖放上传）"""
    projects = load_projects()
    for i, p in enumerate(projects):
        if p["id"] == project_id:
            today = datetime.now().strftime("%Y-%m-%d")
            new_files = []
            for f in body.files:
                entry = f.dict() if hasattr(f, "dict") else f
                if not entry.get("uploaded"):
                    entry["uploaded"] = today
                new_files.append(entry)
            existing_names = {f["name"] for f in p.get("files", [])}
            for f in new_files:
                if f["name"] not in existing_names:
                    p.setdefault("files", []).append(f)
                    existing_names.add(f["name"])
            p["updated_at"] = datetime.now().isoformat()
            projects[i] = p
            save_projects(projects)
            return _enrich_project(p)
    raise HTTPException(status_code=404, detail="项目不存在")


@router.post("/api/projects/{project_id}/files/move")
async def move_project_file(project_id: str, body: FileMoveBody):
    """移动项目内文件或文件夹（需写入授权）"""
    projects = load_projects()
    idx, project = _find_project(projects, project_id)
    if idx < 0:
        raise HTTPException(status_code=404, detail="项目不存在")

    project_path = _require_project_write(project, body.permission_id)
    source = _norm_rel_path(body.source)
    dest_folder = _norm_rel_path(body.dest_folder)
    if not source:
        raise HTTPException(status_code=400, detail="请指定要移动的项")

    full_source = _rel_to_abs(project_path, source)
    dest_dir = _rel_to_abs(project_path, dest_folder) if dest_folder else project_path
    basename = source.rsplit("/", 1)[-1]
    full_dest = os.path.normpath(os.path.join(dest_dir, basename))

    if not os.path.exists(full_source):
        raise HTTPException(status_code=400, detail=f"路径不存在: {source}")
    norm_source = os.path.normpath(full_source)
    norm_dest_dir = os.path.normpath(dest_dir)
    if norm_source == norm_dest_dir or norm_dest_dir.startswith(norm_source + os.sep):
        raise HTTPException(status_code=400, detail="不能将文件夹移动到自身或其子目录")
    if os.path.exists(full_dest):
        raise HTTPException(status_code=400, detail=f"目标已存在: {basename}")

    try:
        shutil.move(full_source, full_dest)
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"移动失败: {exc}") from exc

    project["files"] = _update_paths_after_move(project.get("files") or [], source, dest_folder)
    project["updated_at"] = datetime.now().isoformat()
    projects[idx] = project
    save_projects(projects)
    return _enrich_project(project)


@router.post("/api/projects/{project_id}/files/mkdir")
async def mkdir_project_folder(project_id: str, body: FileMkdirBody):
    """在项目内新建文件夹（需写入授权）"""
    projects = load_projects()
    idx, project = _find_project(projects, project_id)
    if idx < 0:
        raise HTTPException(status_code=404, detail="项目不存在")

    project_path = _require_project_write(project, body.permission_id)
    folder = _norm_rel_path(body.folder)
    if not folder:
        raise HTTPException(status_code=400, detail="请指定文件夹名称")

    full_path = _rel_to_abs(project_path, folder)
    if os.path.exists(full_path):
        raise HTTPException(status_code=400, detail=f"文件夹已存在: {folder}")

    try:
        os.makedirs(full_path)
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"创建文件夹失败: {exc}") from exc

    project["updated_at"] = datetime.now().isoformat()
    projects[idx] = project
    save_projects(projects)
    return _enrich_project(project)


@router.post("/api/projects/{project_id}/files/delete-item")
async def delete_project_file_item(project_id: str, body: FileDeleteBody):
    """删除项目内文件或文件夹（需写入授权）"""
    projects = load_projects()
    idx, project = _find_project(projects, project_id)
    if idx < 0:
        raise HTTPException(status_code=404, detail="项目不存在")

    project_path = _require_project_write(project, body.permission_id)
    target = _norm_rel_path(body.path)
    if not target:
        raise HTTPException(status_code=400, detail="请指定要删除的项")

    full_path = _rel_to_abs(project_path, target)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=400, detail=f"路径不存在: {target}")

    try:
        if os.path.isdir(full_path):
            shutil.rmtree(full_path)
        else:
            os.remove(full_path)
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"删除失败: {exc}") from exc

    project["files"] = _remove_paths_from_index(project.get("files") or [], target)
    project["updated_at"] = datetime.now().isoformat()
    projects[idx] = project
    save_projects(projects)
    return _enrich_project(project)


@router.delete("/api/projects/{project_id}")
async def delete_project(project_id: str):
    """删除项目（仅删除记录，不删除磁盘文件）"""
    projects = load_projects()
    for i, p in enumerate(projects):
        if p["id"] == project_id:
            projects.pop(i)
            save_projects(projects)
            return {"message": "项目已删除"}
    raise HTTPException(status_code=404, detail="项目不存在")
