"""项目管理仪表盘技能 — 所有操作均返回 UI action 供聊天窗口联动"""
from typing import Any, Dict, Optional

from backend.skills.base import BaseSkill
from backend.api.projects import load_projects, save_projects, STAGES


def _find_project(name: str) -> Optional[dict]:
    q = (name or "").strip().lower()
    if not q:
        return None
    projects = load_projects()
    for p in projects:
        if p.get("name", "").lower() == q:
            return p
    for p in projects:
        if q in p.get("name", "").lower():
            return p
    return None


class ManageProjectsSkill(BaseSkill):
    name = "manage_projects"
    description = "管理项目仪表盘：筛选、切换阶段、打开/编辑/删除项目"
    parameters = {
        "action": {"type": "string", "description": "filter/set_stage/open/edit/delete/list"},
        "project_name": {"type": "string", "description": "项目名称"},
        "stage": {"type": "string", "description": "目标阶段"},
        "query": {"type": "string", "description": "名称关键词"},
        "year": {"type": "integer", "description": "年份"},
    }

    async def execute(
        self,
        action: str = "",
        project_name: str = "",
        stage: str = "",
        query: str = "",
        year: int = 0,
    ) -> Dict[str, Any]:
        act = (action or "").strip().lower()

        if act == "filter":
            return {
                "success": True,
                "action": "dashboard_filter",
                "query": (query or project_name or "").strip(),
                "filter_year": year if year else None,
                "filter_stage": (stage or "").strip(),
                "message": "已应用项目筛选",
            }

        if act == "list":
            projects = load_projects()
            names = [p.get("name", "") for p in projects]
            return {
                "success": True,
                "projects": names,
                "count": len(names),
                "message": f"共 {len(names)} 个项目" + (f"：{', '.join(names[:10])}" if names else ""),
            }

        if act in ("open", "edit"):
            target = _find_project(project_name)
            if not target:
                return {"success": False, "message": f"未找到项目：{project_name}"}
            ui_action = "dashboard_open_project" if act == "open" else "dashboard_edit_project"
            return {
                "success": True,
                "action": ui_action,
                "project_id": target["id"],
                "project_name": target["name"],
                "message": f"已打开项目：{target['name']}",
            }

        if act == "set_stage":
            target = _find_project(project_name)
            if not target:
                return {"success": False, "message": f"未找到项目：{project_name}"}
            new_stage = (stage or "").strip()
            if new_stage not in STAGES:
                return {"success": False, "message": f"无效阶段：{new_stage}，可选：{', '.join(STAGES)}"}
            projects = load_projects()
            for i, p in enumerate(projects):
                if p["id"] == target["id"]:
                    from datetime import datetime
                    projects[i]["stage"] = new_stage
                    projects[i]["updated_at"] = datetime.now().isoformat()
                    save_projects(projects)
                    break
            return {
                "success": True,
                "action": "dashboard_set_stage",
                "project_id": target["id"],
                "project_name": target["name"],
                "stage": new_stage,
                "message": f"已将「{target['name']}」阶段改为 {new_stage}",
            }

        if act == "delete":
            target = _find_project(project_name)
            if not target:
                return {"success": False, "message": f"未找到项目：{project_name}"}
            return {
                "success": True,
                "action": "dashboard_delete_project",
                "project_id": target["id"],
                "project_name": target["name"],
                "message": f"请确认删除项目：{target['name']}",
            }

        return {
            "success": False,
            "message": "请指定 action：filter / set_stage / open / edit / delete / list",
        }


skill = ManageProjectsSkill()
