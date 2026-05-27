"""
安全沙箱 API：配置、审核日志、用户放行
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Dict, Optional

from backend.services.safety_auditor import safety_auditor
from backend.services.safety_log_service import list_safety_logs, clear_safety_logs
from backend.api.settings import load_config, save_config

router = APIRouter()


class SafetyConfigUpdate(BaseModel):
    strictness: Optional[str] = None
    rules_enabled: Optional[Dict[str, bool]] = None


class BypassExecuteRequest(BaseModel):
    audit_id: str


@router.get("/api/safety/config")
async def get_safety_config():
    safety_auditor.reload_config()
    return safety_auditor.get_config()


@router.put("/api/safety/config")
async def update_safety_config(body: SafetyConfigUpdate):
    config = load_config()
    safety = dict(config.get("safety") or {})
    if body.strictness is not None:
        if body.strictness not in ("relaxed", "standard", "strict"):
            raise HTTPException(status_code=400, detail="strictness 须为 relaxed/standard/strict")
        safety["strictness"] = body.strictness
    if body.rules_enabled is not None:
        rules = dict(safety.get("rules_enabled") or {})
        rules.update(body.rules_enabled)
        safety["rules_enabled"] = rules
    config["safety"] = safety
    save_config(config)
    safety_auditor.reload_config()
    return {"message": "安全配置已更新", "safety": safety_auditor.get_config()}


@router.get("/api/safety/logs")
async def get_safety_logs():
    return {"logs": list_safety_logs(50)}


@router.delete("/api/safety/logs")
async def delete_safety_logs():
    count = clear_safety_logs()
    return {"message": f"已清除 {count} 条审核日志"}


@router.post("/api/safety/bypass")
async def bypass_and_execute(body: BypassExecuteRequest):
    """用户确认放行后执行被拦截的工具调用"""
    from backend.skills import skill_manager

    pending = safety_auditor.consume_bypass(body.audit_id)
    if not pending:
        raise HTTPException(status_code=404, detail="放行请求不存在或已过期")

    skill_name = pending["skill_name"]
    parameters = pending.get("parameters") or {}

    audit = await safety_auditor.audit(
        skill_name, parameters, user_bypass=True
    )
    if not audit.allowed:
        raise HTTPException(status_code=403, detail=audit.reason)

    result = await skill_manager.execute(skill_name, **parameters)
    result["user_bypass"] = True
    result["audit_id"] = body.audit_id
    return result
