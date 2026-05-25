"""
目录扫描 API
扫描本地目录发现项目，并注册为仪表盘项目卡片
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import json
import os
import uuid
from datetime import datetime

from backend.engine.scanner import DirectoryScanner
from backend.api.projects import load_projects, save_projects, ProjectResponse

router = APIRouter()

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "..", "config.json")
DEFAULT_SCANNER = {
    "watch_dirs": [],
    "max_depth": 3,
    "auto_register": False,
}

scanner_engine = DirectoryScanner()


def _load_config() -> dict:
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


class ScanRequest(BaseModel):
    root_path: str
    quick: bool = False
    depth: int = 2


class RegisterRequest(BaseModel):
    name: str
    path: str
    project_type: str = ""
    buildings: List[str] = []
    notes: str = ""


@router.get("/api/scanner/config")
async def get_scanner_config():
    """读取扫描配置（默认监控目录等）"""
    config = _load_config()
    scanner_cfg = config.get("scanner", DEFAULT_SCANNER)
    return {
        "watch_dirs": scanner_cfg.get("watch_dirs", []),
        "max_depth": scanner_cfg.get("max_depth", 3),
        "auto_register": scanner_cfg.get("auto_register", False),
    }


@router.post("/api/scanner/scan")
async def scan_directories(body: ScanRequest):
    """扫描指定根目录，返回发现的项目列表"""
    root_path = os.path.normpath(body.root_path.strip())
    if not root_path:
        raise HTTPException(status_code=400, detail="请提供有效的目录路径")

    if not os.path.isdir(root_path):
        raise HTTPException(status_code=400, detail=f"目录不存在或不可访问: {root_path}")

    config = _load_config()
    max_depth = config.get("scanner", {}).get("max_depth", 3)

    if body.quick:
        result = scanner_engine.quick_scan(root_path, depth=body.depth)
    else:
        result = scanner_engine.scan(root_path, max_depth=max_depth)

    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])

    return result


@router.post("/api/scanner/register", response_model=ProjectResponse)
async def register_scanned_project(body: RegisterRequest):
    """将扫描发现的项目注册为仪表盘项目卡片"""
    name = body.name.strip()
    path = os.path.normpath(body.path.strip())
    if not name:
        raise HTTPException(status_code=400, detail="项目名称不能为空")
    if not path:
        raise HTTPException(status_code=400, detail="项目路径不能为空")

    projects = load_projects()
    for p in projects:
        if p["name"] == name:
            raise HTTPException(status_code=400, detail=f"项目「{name}」已存在，请勿重复注册")
        if path in (p.get("notes") or ""):
            raise HTTPException(status_code=400, detail=f"目录已注册: {path}")

    notes = body.notes.strip() if body.notes else f"扫描注册，目录：{path}"

    now = datetime.now().isoformat()
    new_project = {
        "id": str(uuid.uuid4()),
        "name": name,
        "project_type": body.project_type,
        "buildings": body.buildings,
        "notes": notes,
        "stage": "清单阶段",
        "created_at": now,
        "updated_at": now,
    }
    projects.append(new_project)
    save_projects(projects)
    return ProjectResponse(**new_project)
