"""
日志与错误报告 API
"""
import json
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

from backend.services.chat_log_service import clear_chat_logs, list_chat_logs
from backend.services.error_log_service import (
    clear_errors,
    format_errors_report,
    list_errors,
)
from backend.services.llm_engine import llm_engine

router = APIRouter()


class SummarizeErrorsRequest(BaseModel):
    limit: int = 50


@router.get("/api/logs")
async def get_logs(q: Optional[str] = None, limit: int = 500):
    """返回对话请求/响应日志列表"""
    logs = list_chat_logs(query=q, limit=min(limit, 2000))
    return {"logs": logs, "count": len(logs)}


@router.delete("/api/logs")
async def clear_logs():
    """清空对话日志"""
    removed = clear_chat_logs()
    return {"success": True, "removed": removed}


@router.get("/api/logs/export")
async def export_logs(q: Optional[str] = None):
    """导出对话日志 JSON"""
    logs = list_chat_logs(query=q, limit=5000)
    content = json.dumps({"logs": logs, "count": len(logs)}, ensure_ascii=False, indent=2)
    return PlainTextResponse(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="chat_log.json"'},
    )


@router.get("/api/errors")
async def get_errors(limit: int = 500):
    """返回 API 错误日志列表"""
    errors = list_errors(limit=min(limit, 2000))
    return {"errors": errors, "count": len(errors)}


@router.delete("/api/errors")
async def clear_error_logs():
    """清空错误日志"""
    removed = clear_errors()
    return {"success": True, "removed": removed}


@router.get("/api/errors/export")
async def export_errors_report():
    """导出错误报告纯文本"""
    report = format_errors_report()
    return PlainTextResponse(
        content=report,
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="error_report.txt"'},
    )


@router.post("/api/errors/summarize")
async def summarize_errors(body: SummarizeErrorsRequest):
    """使用 LLM 将错误汇总为中文文档"""
    errors = list_errors(limit=min(body.limit, 100))
    if not errors:
        return {"document": "当前没有可汇总的错误记录。"}

    report = format_errors_report(errors)
    prompt = (
        "请将以下 FindWay Agent 应用错误日志汇总为一份简洁的中文故障分析文档，"
        "包含：问题概述、按类型分类的主要错误、可能原因、建议排查步骤。使用 Markdown 格式。\n\n"
        f"{report}"
    )

    api_config = llm_engine.get_default_config()
    if not api_config or not llm_engine.resolve_api_config(api_config.get("id", "")):
        raise HTTPException(
            status_code=400,
            detail="未配置 LLM API，无法自动生成错误文档。请使用「导出错误报告」。",
        )

    resolved_id = api_config.get("id")
    document = await llm_engine.chat(
        message=prompt,
        history=[],
        api_config_id=resolved_id,
    )
    return {"document": document, "error_count": len(errors)}
