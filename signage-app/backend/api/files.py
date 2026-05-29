"""
项目文件操作 API — 上传与删除
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional
import os

from backend.api.scanner import _check_permission

router = APIRouter()


class DeleteFileRequest(BaseModel):
    path: str
    permission_id: Optional[str] = None


def _require_write_permission(path: str, permission_id: Optional[str]) -> str:
    norm_path = os.path.normpath(path.strip())
    if not norm_path:
        raise HTTPException(status_code=400, detail="请提供有效的路径")
    if not permission_id:
        raise HTTPException(
            status_code=403,
            detail="未获得用户授权，操作已取消。请先确认权限。",
        )
    parent = os.path.dirname(norm_path) if os.path.isfile(norm_path) else norm_path
    if not _check_permission(permission_id, parent, "write"):
        raise HTTPException(
            status_code=403,
            detail="未获得用户授权或授权已过期，操作已取消。",
        )
    return norm_path


@router.post("/api/files/upload")
async def upload_file(
    file: UploadFile = File(...),
    target_dir: str = Form(...),
    permission_id: str = Form(...),
):
    """上传文件到指定项目文件夹（需写入授权）"""
    dir_path = _require_write_permission(target_dir, permission_id)
    if not os.path.isdir(dir_path):
        raise HTTPException(status_code=400, detail=f"目标目录不存在: {dir_path}")

    filename = os.path.basename(file.filename or "")
    if not filename or filename in (".", ".."):
        raise HTTPException(status_code=400, detail="无效的文件名")

    dest_path = os.path.join(dir_path, filename)
    if os.path.exists(dest_path):
        raise HTTPException(status_code=400, detail=f"文件已存在: {filename}")

    try:
        content = await file.read()
        with open(dest_path, "wb") as f:
            f.write(content)
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"文件上传失败: {exc}") from exc

    return {
        "success": True,
        "path": os.path.normpath(dest_path),
        "name": filename,
        "size": len(content),
    }


@router.delete("/api/files/delete")
async def delete_file(body: DeleteFileRequest):
    """删除指定文件（需写入授权）"""
    file_path = _require_write_permission(body.path, body.permission_id)
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=400, detail=f"文件不存在: {file_path}")

    try:
        os.remove(file_path)
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"文件删除失败: {exc}") from exc

    return {"success": True, "path": file_path}
