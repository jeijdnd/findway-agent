"""
项目管理API模块
提供项目的CRUD操作，数据存储在JSON文件
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import json
import os
import uuid
from datetime import datetime

router = APIRouter()

# 数据文件路径
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
PROJECTS_PATH = os.path.join(DATA_DIR, "projects_index.json")

class ProjectCreate(BaseModel):
    """创建项目请求模型"""
    name: str
    project_type: str = ""
    buildings: List[str] = []
    notes: str = ""

class ProjectUpdate(BaseModel):
    """更新项目请求模型"""
    name: Optional[str] = None
    project_type: Optional[str] = None
    buildings: Optional[List[str]] = None
    notes: Optional[str] = None
    stage: Optional[str] = None

class ProjectResponse(BaseModel):
    """项目响应模型"""
    id: str
    name: str
    project_type: str
    buildings: List[str]
    notes: str
    stage: str
    created_at: str
    updated_at: str

def load_projects() -> List[dict]:
    """加载所有项目数据"""
    try:
        if os.path.exists(PROJECTS_PATH):
            with open(PROJECTS_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception:
        pass
    return []

def save_projects(projects: List[dict]):
    """保存所有项目数据"""
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(PROJECTS_PATH, "w", encoding="utf-8") as f:
        json.dump(projects, f, ensure_ascii=False, indent=2)

@router.get("/api/projects", response_model=List[ProjectResponse])
async def list_projects():
    """获取所有项目列表"""
    projects = load_projects()
    return [ProjectResponse(**p) for p in projects]

@router.post("/api/projects", response_model=ProjectResponse)
async def create_project(project: ProjectCreate):
    """创建新项目"""
    projects = load_projects()
    now = datetime.now().isoformat()
    new_project = {
        "id": str(uuid.uuid4()),
        "name": project.name,
        "project_type": project.project_type,
        "buildings": project.buildings,
        "notes": project.notes,
        "stage": "清单阶段",
        "created_at": now,
        "updated_at": now,
    }
    projects.append(new_project)
    save_projects(projects)
    return ProjectResponse(**new_project)

@router.get("/api/projects/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str):
    """获取单个项目详情"""
    projects = load_projects()
    for p in projects:
        if p["id"] == project_id:
            return ProjectResponse(**p)
    raise HTTPException(status_code=404, detail="项目不存在")

@router.put("/api/projects/{project_id}", response_model=ProjectResponse)
async def update_project(project_id: str, update: ProjectUpdate):
    """更新项目信息"""
    projects = load_projects()
    for i, p in enumerate(projects):
        if p["id"] == project_id:
            update_data = update.dict(exclude_unset=True)
            update_data["updated_at"] = datetime.now().isoformat()
            projects[i].update(update_data)
            save_projects(projects)
            return ProjectResponse(**projects[i])
    raise HTTPException(status_code=404, detail="项目不存在")

@router.delete("/api/projects/{project_id}")
async def delete_project(project_id: str):
    """删除项目"""
    projects = load_projects()
    for i, p in enumerate(projects):
        if p["id"] == project_id:
            projects.pop(i)
            save_projects(projects)
            return {"message": "项目已删除"}
    raise HTTPException(status_code=404, detail="项目不存在")