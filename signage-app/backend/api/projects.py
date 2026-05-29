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
    load_user_preferences,
    save_user_preferences,
    DEFAULT_PROJECT_ROOT,
)

router = APIRouter()

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


class ProjectConfigUpdate(BaseModel):
    default_project_path: str


def _stage_group(stage: str) -> str:
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
    prefs = load_user_preferences()
    root = prefs.get("default_project_path", DEFAULT_PROJECT_ROOT)
    return os.path.normpath(os.path.join(root, name))


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


@router.get("/api/projects/config")
async def get_project_config():
    """获取项目默认路径配置"""
    prefs = load_user_preferences()
    return {
        "default_project_path": prefs.get("default_project_path", DEFAULT_PROJECT_ROOT),
    }


@router.put("/api/projects/config")
async def update_project_config(update: ProjectConfigUpdate):
    """更新项目默认路径"""
    path = update.default_project_path.strip()
    if not path:
        raise HTTPException(status_code=400, detail="项目路径不能为空")
    prefs = load_user_preferences()
    prefs["default_project_path"] = os.path.normpath(path)
    save_user_preferences(prefs)
    return {"default_project_path": prefs["default_project_path"]}


@router.get("/api/projects")
async def list_projects():
    """获取所有项目，按阶段分组"""
    projects = load_projects()
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
    return new_project


@router.get("/api/projects/{project_id}")
async def get_project(project_id: str):
    """获取单个项目详情"""
    projects = load_projects()
    for p in projects:
        if p["id"] == project_id:
            return p
    raise HTTPException(status_code=404, detail="项目不存在")


@router.put("/api/projects/{project_id}")
async def update_project(project_id: str, update: ProjectUpdate):
    """更新项目信息"""
    projects = load_projects()
    for i, p in enumerate(projects):
        if p["id"] == project_id:
            data = update.dict(exclude_unset=True)
            if "stage" in data and data["stage"] not in STAGES:
                raise HTTPException(status_code=400, detail=f"无效阶段: {data['stage']}")
            if "files" in data:
                data["files"] = [f if isinstance(f, dict) else f.dict() for f in data["files"]]
            data["updated_at"] = datetime.now().isoformat()
            projects[i].update(data)
            save_projects(projects)
            return projects[i]
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
            return p
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
