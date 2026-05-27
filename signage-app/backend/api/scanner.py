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
from backend.services.app_data import get_app_data_dir

router = APIRouter()

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "..", "config.json")
DEFAULT_SCANNER = {
    "watch_dirs": [],
    "max_depth": 3,
    "auto_register": False,
}

PERMISSION_TTL_MINUTES = 30
REMEMBERABLE_OPERATIONS = frozenset({"scan", "read"})
OPERATION_LABELS = {
    "scan": "扫描",
    "read": "读取",
    "write": "写入",
}

scanner_engine = DirectoryScanner()
_pending_permissions: Dict[str, Dict[str, Any]] = {}
_granted_permissions: Dict[str, Dict[str, Any]] = {}


def _remembered_permissions_path() -> str:
    return os.path.join(get_app_data_dir(), "remembered_permissions.json")


def _load_remembered_permissions() -> Dict[str, List[str]]:
    default: Dict[str, List[str]] = {"scan": [], "read": []}
    path = _remembered_permissions_path()
    if not os.path.exists(path):
        return default
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError):
        return default
    result = dict(default)
    for op in REMEMBERABLE_OPERATIONS:
        raw = data.get(op) or []
        result[op] = [
            os.path.normpath(str(p).strip())
            for p in raw
            if str(p).strip()
        ]
    return result


def _save_remembered_permissions(data: Dict[str, List[str]]) -> None:
    payload = {op: data.get(op, []) for op in REMEMBERABLE_OPERATIONS}
    path = _remembered_permissions_path()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


def _path_covered_by_grant(norm_path: str, norm_grant: str) -> bool:
    return norm_path == norm_grant or norm_path.startswith(norm_grant + os.sep)


def _is_remembered_for_path(path: str, operation: str) -> bool:
    if operation not in REMEMBERABLE_OPERATIONS:
        return False
    norm_path = os.path.normpath(path.strip())
    remembered = _load_remembered_permissions()
    for rem in remembered.get(operation, []):
        if _path_covered_by_grant(norm_path, os.path.normpath(rem)):
            return True
    return False


def _add_remembered_permission(operation: str, path: str) -> None:
    if operation not in REMEMBERABLE_OPERATIONS:
        return
    data = _load_remembered_permissions()
    norm = os.path.normpath(path.strip())
    paths = data.setdefault(operation, [])
    if norm not in paths:
        paths.append(norm)
        _save_remembered_permissions(data)


def _remove_remembered_permission(operation: str, path: str) -> bool:
    if operation not in REMEMBERABLE_OPERATIONS:
        return False
    data = _load_remembered_permissions()
    norm = os.path.normpath(path.strip())
    paths = data.get(operation, [])
    if norm not in paths:
        return False
    paths.remove(norm)
    data[operation] = paths
    _save_remembered_permissions(data)
    return True


def _grant_session_permission(path: str, operation: str, from_remembered: bool = False) -> str:
    request_id = str(uuid.uuid4())
    expires_at = datetime.now() + timedelta(
        days=36500 if from_remembered else 0,
        minutes=0 if from_remembered else PERMISSION_TTL_MINUTES,
    )
    _granted_permissions[request_id] = {
        "path": path,
        "operation": operation,
        "granted": True,
        "expires_at": expires_at.isoformat(),
        "from_remembered": from_remembered,
    }
    return request_id


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
    norm_path = os.path.normpath(path.strip())

    grant = _granted_permissions.get(permission_id)
    if grant and grant.get("granted") and grant.get("operation") == operation:
        norm_grant = os.path.normpath(grant["path"])
        if _path_covered_by_grant(norm_path, norm_grant):
            return True

    if operation in REMEMBERABLE_OPERATIONS and _is_remembered_for_path(path, operation):
        return True
    return False


class PermissionRequest(BaseModel):
    path: str
    operation: str = "scan"


class PermissionConfirm(BaseModel):
    request_id: str
    granted: bool
    remember: bool = False


class RememberedRevokeRequest(BaseModel):
    operation: str
    path: str


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

    op_label = OPERATION_LABELS[operation]
    rememberable = operation in REMEMBERABLE_OPERATIONS

    if rememberable and _is_remembered_for_path(path, operation):
        request_id = _grant_session_permission(path, operation, from_remembered=True)
        return {
            "request_id": request_id,
            "path": path,
            "operation": operation,
            "granted": True,
            "requires_confirmation": False,
            "rememberable": True,
            "message": f"已使用记住的{op_label}授权: {path}",
        }

    request_id = str(uuid.uuid4())
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
        "rememberable": rememberable,
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
        if (
            body.remember
            and pending["operation"] in REMEMBERABLE_OPERATIONS
        ):
            _add_remembered_permission(pending["operation"], pending["path"])

        expires_at = datetime.now() + timedelta(minutes=PERMISSION_TTL_MINUTES)
        _granted_permissions[body.request_id] = {
            **pending,
            "granted": True,
            "expires_at": expires_at.isoformat(),
        }
        return {
            "request_id": body.request_id,
            "granted": True,
            "remembered": bool(body.remember),
            "message": f"已授权{op_label}目录: {pending['path']}",
            "expires_at": expires_at.isoformat(),
        }

    return {
        "request_id": body.request_id,
        "granted": False,
        "message": f"您已拒绝{op_label}操作，AI 无法访问该目录。",
    }


@router.get("/api/scanner/remembered-permissions")
async def list_remembered_permissions():
    """列出已记住的只读授权"""
    data = _load_remembered_permissions()
    permissions = []
    for operation in sorted(REMEMBERABLE_OPERATIONS):
        for path in data.get(operation, []):
            permissions.append({
                "operation": operation,
                "path": path,
                "label": OPERATION_LABELS.get(operation, operation),
            })
    return {"permissions": permissions}


@router.delete("/api/scanner/remembered-permissions")
async def clear_remembered_permissions():
    """清除全部已记住的只读授权"""
    _save_remembered_permissions({"scan": [], "read": []})
    return {"success": True, "message": "已清除全部记住的授权"}


@router.post("/api/scanner/remembered-permissions/revoke")
async def revoke_remembered_permission(body: RememberedRevokeRequest):
    """撤销单条已记住的授权"""
    operation = body.operation.strip().lower()
    if operation not in REMEMBERABLE_OPERATIONS:
        raise HTTPException(status_code=400, detail=f"不支持的操作类型: {operation}")
    path = os.path.normpath(body.path.strip())
    if not path:
        raise HTTPException(status_code=400, detail="请提供有效的目录路径")
    if not _remove_remembered_permission(operation, path):
        raise HTTPException(status_code=404, detail="未找到该记住的授权")
    return {"success": True, "message": "已撤销该授权"}


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
