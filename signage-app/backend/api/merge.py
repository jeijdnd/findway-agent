"""
兔钉清单合并 API
提供预览、应用合并和模板列表功能
"""
import os
import tempfile
from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel

from backend.services.merge_engine import merge_engine

router = APIRouter()

# 临时文件和输出目录
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
TEMP_DIR = os.path.join(DATA_DIR, "merge_temp")
OUTPUT_DIR = os.path.join(DATA_DIR, "merge_output")


class MergeApplyResponse(BaseModel):
    """合并应用响应"""
    output_path: str
    output_name: str
    result: dict


def _ensure_dirs():
    """确保临时和输出目录存在"""
    os.makedirs(TEMP_DIR, exist_ok=True)
    os.makedirs(OUTPUT_DIR, exist_ok=True)


async def _save_upload(file: UploadFile, dest_dir: str) -> str:
    """保存上传文件到指定目录，返回文件路径"""
    if not file.filename:
        raise HTTPException(status_code=400, detail="文件名不能为空")
    if not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="只支持 .xlsx / .xls 文件")

    file_path = os.path.join(dest_dir, file.filename)
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
    return file_path


@router.post("/api/merge/preview")
async def merge_preview(
    tuding_file: UploadFile = File(..., description="兔钉导出 xlsx"),
    checklist_file: UploadFile = File(..., description="完整清单 xlsx"),
):
    """
    合并预览：读取兔钉导出 + 完整清单，返回 MergeResult JSON（不写入文件）
    """
    _ensure_dirs()
    temp_subdir = tempfile.mkdtemp(dir=TEMP_DIR, prefix="preview_")

    try:
        tuding_path = await _save_upload(tuding_file, temp_subdir)
        checklist_path = await _save_upload(checklist_file, temp_subdir)

        tuding_data = merge_engine.read_tuding_export(tuding_path)
        checklist_data = merge_engine.read_full_checklist(checklist_path)
        result = merge_engine.merge(tuding_data, checklist_data)

        return {
            "success": True,
            "tuding_file": tuding_file.filename,
            "checklist_file": checklist_file.filename,
            "result": result,
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"合并预览失败: {str(e)}")


@router.post("/api/merge/apply")
async def merge_apply(
    tuding_file: UploadFile = File(..., description="兔钉导出 xlsx"),
    checklist_file: UploadFile = File(..., description="完整清单模板 xlsx"),
    output_name: str = Form(..., description="输出文件名（不含路径）"),
):
    """
    合并应用：读取 → 合并 → 生成新清单文件
    """
    _ensure_dirs()

    if not output_name.lower().endswith(".xlsx"):
        output_name = output_name + ".xlsx"

    temp_subdir = tempfile.mkdtemp(dir=TEMP_DIR, prefix="apply_")

    try:
        tuding_path = await _save_upload(tuding_file, temp_subdir)
        checklist_path = await _save_upload(checklist_file, temp_subdir)

        tuding_data = merge_engine.read_tuding_export(tuding_path)
        checklist_data = merge_engine.read_full_checklist(checklist_path)
        result = merge_engine.merge(tuding_data, checklist_data)

        output_path = os.path.join(OUTPUT_DIR, output_name)
        merge_engine.generate_checklist(
            merge_result=result,
            template_path=checklist_path,
            output_path=output_path,
            checklist_data=checklist_data,
        )

        return {
            "success": True,
            "output_path": output_path,
            "output_name": output_name,
            "result": result,
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"合并应用失败: {str(e)}")


@router.get("/api/merge/download/{filename}")
async def download_merge_output(filename: str):
    """下载合并生成的清单文件"""
    _ensure_dirs()
    safe_name = os.path.basename(filename)
    if not safe_name.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="无效的文件名")

    file_path = os.path.join(OUTPUT_DIR, safe_name)
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="文件不存在或已过期")

    return FileResponse(
        file_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=safe_name,
    )


@router.get("/api/merge/templates")
async def list_merge_templates():
    """
    列出可用清单模板（扫描 data/templates 和 data 目录下的完整清单 xlsx）
    """
    try:
        templates = merge_engine.list_templates()
        return {"templates": templates, "count": len(templates)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取模板列表失败: {str(e)}")
