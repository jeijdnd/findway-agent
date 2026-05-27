"""
目录扫描 API
扫描本地目录发现项目，并注册为仪表盘项目卡片
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import json
import os
import uuid
from datetime import datetime, timedelta

from backend.engine.scanner import DirectoryScanner
from backend.api.projects import load_projects, save_projects, ProjectResponse

router = APIRouter()

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "..", "config.json")
DEFAULT_SCANNER = {
    "watch_dirs": [],
    "max_depth": 3,
    "auto_register": False,
}

PERMISSION_TTL_MINUTES = 30
OPERATION_LABELS = {
    "scan": "扫描",
    "read": "读取",
    "write": "写入",
}

scanner_engine = DirectoryScanner()
_pending_permissions: Dict[str, Dict[str, Any]] = {}
_granted_permissions: Dict[str, Dict[str, Any]] = {}


def _load_config() -> dict:
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def _cleanup_expired_permissions() -> None:
    now = datetime.now()
    expired = [
        rid for rid, grant in _granted_permissions.items()
        if now > datetime.fromisoformat(grant["expires_at"])
    ]
    for rid in expired:
        _granted_permissions.pop(rid, None)
        _pending_permissions.pop(rid, None)


def _check_permission(permission_id: str, path: str, operation: str) -> bool:
    _cleanup_expired_permissions()
    grant = _granted_permissions.get(permission_id)
    if not grant or not grant.get("granted"):
        return False
    if grant.get("operation") != operation:
        return False

    norm_path = os.path.normpath(path.strip())
    norm_grant = os.path.normpath(grant["path"])
    if norm_path != norm_grant and not norm_path.startswith(norm_grant + os.sep):
        return False
    return True


class PermissionRequest(BaseModel):
    path: str
    operation: str = "scan"


class PermissionConfirm(BaseModel):
    request_id: str
    granted: bool


class ScanRequest(BaseModel):
    root_path: str
    quick: bool = False
    depth: int = 2
    permission_id: Optional[str] = None


class RegisterRequest(BaseModel):
    name: str
    path: str
    project_type: str = ""
    buildings: List[str] = []
    notes: str = ""
    permission_id: Optional[str] = None


class ListSubdirsRequest(BaseModel):
    path: str
    max_depth: int = 3
    permission_id: Optional[str] = None


def _list_subdirs_with_permission(
    root_path: str,
    max_depth: int,
    permission_id: Optional[str],
) -> dict:
    root_path = os.path.normpath(root_path.strip())
    if not root_path:
        raise HTTPException(status_code=400, detail="请提供有效的目录路径")

    if not permission_id:
        raise HTTPException(
            status_code=403,
            detail="未获得用户授权，操作已取消。请先确认权限。",
        )

    if not _check_permission(permission_id, root_path, "scan"):
        raise HTTPException(
            status_code=403,
            detail="未获得用户授权或授权已过期，操作已取消。",
        )

    if not os.path.isdir(root_path):
        raise HTTPException(
            status_code=400,
            detail=f"目录不存在或不可访问: {root_path}",
        )

    result = scanner_engine.list_subdirs(root_path, max_depth=max_depth)
    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])
    return result


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


@router.post("/api/scanner/request-permission")
async def request_permission(body: PermissionRequest):
    """申请目录操作权限，返回 request_id 供前端弹窗确认"""
    path = os.path.normpath(body.path.strip())
    operation = body.operation.strip().lower()

    if operation not in OPERATION_LABELS:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的操作类型: {operation}，仅支持 scan/read/write",
        )
    if not path:
        raise HTTPException(status_code=400, detail="请提供有效的目录路径")

    request_id = str(uuid.uuid4())
    op_label = OPERATION_LABELS[operation]
    _pending_permissions[request_id] = {
        "path": path,
        "operation": operation,
        "created_at": datetime.now().isoformat(),
        "granted": None,
    }

    return {
        "request_id": request_id,
        "path": path,
        "operation": operation,
        "granted": False,
        "requires_confirmation": True,
        "message": f"AI 请求{op_label}目录: {path}",
        "prompt_title": "文件操作确认",
        "prompt_message": f"允许 AI {op_label}以下目录吗？",
        "prompt_detail": path,
    }


@router.post("/api/scanner/confirm-permission")
async def confirm_permission(body: PermissionConfirm):
    """记录用户对权限申请的确认结果"""
    pending = _pending_permissions.get(body.request_id)
    if not pending:
        raise HTTPException(status_code=404, detail="权限请求不存在或已过期")

    pending["granted"] = body.granted
    op_label = OPERATION_LABELS.get(pending["operation"], pending["operation"])

    if body.granted:
        expires_at = datetime.now() + timedelta(minutes=PERMISSION_TTL_MINUTES)
        _granted_permissions[body.request_id] = {
            **pending,
            "granted": True,
            "expires_at": expires_at.isoformat(),
        }
        return {
            "request_id": body.request_id,
            "granted": True,
            "message": f"已授权{op_label}目录: {pending['path']}",
            "expires_at": expires_at.isoformat(),
        }

    return {
        "request_id": body.request_id,
        "granted": False,
        "message": f"您已拒绝{op_label}操作，AI 无法访问该目录。",
    }


@router.get("/api/scanner/list-subdirs")
async def list_subdirs_get(
    path: str,
    max_depth: int = 3,
    permission_id: Optional[str] = None,
):
    """列出指定路径下所有子目录（需用户授权）"""
    config = _load_config()
    default_depth = config.get("scanner", {}).get("max_depth", 3)
    depth = max_depth if max_depth > 0 else default_depth
    return _list_subdirs_with_permission(path, depth, permission_id)


@router.post("/api/scanner/list-subdirs")
async def list_subdirs_post(body: ListSubdirsRequest):
    """列出指定路径下所有子目录（需用户授权）"""
    config = _load_config()
    default_depth = config.get("scanner", {}).get("max_depth", 3)
    depth = body.max_depth if body.max_depth > 0 else default_depth
    return _list_subdirs_with_permission(body.path, depth, body.permission_id)


@router.post("/api/scanner/scan")
async def scan_directories(body: ScanRequest):
    """扫描指定根目录，返回发现的项目列表（需用户授权）"""
    root_path = os.path.normpath(body.root_path.strip())
    if not root_path:
        raise HTTPException(status_code=400, detail="请提供有效的目录路径")

    if not body.permission_id:
        raise HTTPException(status_code=403, detail="未获得用户授权，操作已取消。请先确认权限。")

    if not _check_permission(body.permission_id, root_path, "scan"):
        raise HTTPException(status_code=403, detail="未获得用户授权或授权已过期，操作已取消。")

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
    """将扫描发现的项目注册为仪表盘项目卡片（写入操作需用户授权）"""
    name = body.name.strip()
    path = os.path.normpath(body.path.strip())
    if not name:
        raise HTTPException(status_code=400, detail="项目名称不能为空")
    if not path:
        raise HTTPException(status_code=400, detail="项目路径不能为空")

    if not body.permission_id:
        raise HTTPException(status_code=403, detail="未获得用户授权，操作已取消。请先确认权限。")

    if not _check_permission(body.permission_id, path, "write"):
        raise HTTPException(status_code=403, detail="未获得用户授权或授权已过期，操作已取消。")

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
