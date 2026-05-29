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
from datetime import datetime

from backend.services.app_data import (
    get_projects_index_path,
    get_default_project_path,
    DEFAULT_PROJECT_ROOT,
)
from backend.engine.scanner import DirectoryScanner

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
    return enriched


def _enrich_projects(projects: List[dict]) -> List[dict]:
    return [_enrich_project(p) for p in projects]


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
