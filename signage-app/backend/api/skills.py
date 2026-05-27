"""
技能 API：列表、启用/禁用、发现市场、GitHub 安装
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from backend.skills import skill_manager

router = APIRouter()


class ToggleSkillRequest(BaseModel):
    enabled: Optional[bool] = None


class DiscoverFromGithubRequest(BaseModel):
    query: str


class InstallFromGithubRequest(BaseModel):
    repo_url: str


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


@router.post("/api/skills/discover-from-github")
async def discover_from_github(body: DiscoverFromGithubRequest):
    """从 GitHub 搜索 topic:findway-skill 技能仓库"""
    query = body.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="请提供搜索关键词")
    return skill_manager.discover_from_github(query)


@router.post("/api/skills/install-from-github")
async def install_from_github(body: InstallFromGithubRequest):
    """从 GitHub 安装技能到 installed/ 并自动启用"""
    repo_url = body.repo_url.strip()
    if not repo_url:
        raise HTTPException(status_code=400, detail="请提供仓库 URL")
    try:
        result = skill_manager.install_from_github(repo_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"安装失败: {e}") from e
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "安装失败"))
    return result
