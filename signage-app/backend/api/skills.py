"""
技能 API：列表、启用/禁用、发现市场
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from backend.skills import skill_manager

router = APIRouter()


class ToggleSkillRequest(BaseModel):
    enabled: Optional[bool] = None


@router.get("/api/skills")
async def list_skills():
    """列出所有已安装技能及启用状态（不含系统内建技能的开关）"""
    skills = [
        s for s in skill_manager.list_all()
        if not s.get("internal")
    ]
    return {
        "skills": skills,
        "enabled": [s["name"] for s in skills if s["enabled"]],
    }


@router.post("/api/skills/{name}/toggle")
async def toggle_skill(name: str, body: ToggleSkillRequest = ToggleSkillRequest()):
    """启用或禁用技能"""
    if not skill_manager.has_skill(name):
        raise HTTPException(status_code=404, detail=f"技能不存在: {name}")
    info = skill_manager._skills.get(name, {})
    if info.get("internal"):
        raise HTTPException(status_code=400, detail="系统内建技能不可切换")

    if body.enabled is not None:
        skill_manager.set_enabled(name, body.enabled)
        return {"name": name, "enabled": body.enabled}

    new_state = skill_manager.toggle(name)
    if new_state is None:
        raise HTTPException(status_code=404, detail=f"无法切换技能: {name}")
    return {"name": name, "enabled": new_state}


@router.get("/api/skills/discover")
async def discover_skills():
    """技能市场发现（示例 GitHub 搜索链接）"""
    installed = {s["name"] for s in skill_manager.list_all()}
    catalog = skill_manager.get_discover_catalog()
    for item in catalog:
        item["installed"] = item["name"] in installed
    return {"catalog": catalog}
