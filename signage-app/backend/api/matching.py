"""
旧项目匹配API模块
提供旧项目搜索、扫描和预览功能
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import json
from datetime import datetime

from backend.engine.indexer import ProjectIndexer

router = APIRouter()

# 数据文件路径
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
INDEX_PATH = os.path.join(DATA_DIR, "old_projects_index.json")

class SearchRequest(BaseModel):
    """搜索请求模型"""
    project_type: Optional[str] = None
    keywords: Optional[str] = None

class ScanRequest(BaseModel):
    """扫描请求模型"""
    dir_path: str

class ProjectPreview(BaseModel):
    """项目预览模型"""
    id: str
    file_name: str
    file_path: str
    project_type: str
    sheet_names: List[str]
    headers: List[str]
    row_count: int
    preview_data: List[List[Any]]

class MatchResult(BaseModel):
    """匹配结果模型"""
    id: str
    file_name: str
    file_path: str
    project_type: str
    match_score: float
    match_reason: str
    sheet_names: List[str]
    headers: List[str]
    row_count: int

class ScanResponse(BaseModel):
    """扫描响应模型"""
    success: bool
    message: str
    total_count: int
    projects: List[Dict[str, Any]]

@router.post("/api/matching/search", response_model=List[MatchResult])
async def search_projects(request: SearchRequest):
    """
    搜索旧项目
    
    根据项目类型和关键词搜索匹配的旧项目
    返回TOP 5匹配结果
    """
    try:
        indexer = ProjectIndexer()
        results = indexer.search_projects(
            project_type=request.project_type,
            keywords=request.keywords
        )
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"搜索旧项目失败: {str(e)}")

@router.post("/api/matching/scan", response_model=ScanResponse)
async def scan_directory(request: ScanRequest):
    """
    扫描指定目录，建立旧项目索引
    
    扫描指定目录下的所有Excel文件，提取指纹信息并保存到索引文件
    """
    try:
        # 检查目录是否存在
        if not os.path.exists(request.dir_path):
            return ScanResponse(
                success=False,
                message=f"目录不存在: {request.dir_path}",
                total_count=0,
                projects=[]
            )
        
        indexer = ProjectIndexer()
        index_data = indexer.build_index(request.dir_path)
        
        return ScanResponse(
            success=True,
            message=f"扫描完成，找到 {index_data['total_count']} 个项目",
            total_count=index_data["total_count"],
            projects=index_data["projects"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"扫描目录失败: {str(e)}")

@router.get("/api/matching/preview/{project_id}", response_model=ProjectPreview)
async def preview_project(project_id: str):
    """
    预览项目Excel内容
    
    读取指定项目的Excel文件前20行数据
    """
    try:
        # 加载索引数据
        if not os.path.exists(INDEX_PATH):
            raise HTTPException(status_code=404, detail="索引文件不存在，请先扫描旧项目目录")
        
        with open(INDEX_PATH, "r", encoding="utf-8") as f:
            index_data = json.load(f)
        
        # 查找项目
        project = None
        for p in index_data.get("projects", []):
            if p["id"] == project_id:
                project = p
                break
        
        if not project:
            raise HTTPException(status_code=404, detail="项目不存在")
        
        # 读取Excel文件前20行
        file_path = project["file_path"]
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Excel文件不存在")
        
        import openpyxl
        wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
        
        if not project["sheet_names"]:
            wb.close()
            raise HTTPException(status_code=404, detail="Excel文件没有工作表")
        
        first_sheet = wb[project["sheet_names"][0]]
        
        # 读取前20行数据
        preview_data = []
        row_count = 0
        for row in first_sheet.iter_rows(max_row=21, values_only=True):  # 21行包括表头
            preview_data.append(list(row))
            row_count += 1
            if row_count >= 21:
                break
        
        wb.close()
        
        return ProjectPreview(
            id=project["id"],
            file_name=project["file_name"],
            file_path=project["file_path"],
            project_type=project["project_type"],
            sheet_names=project["sheet_names"],
            headers=project["headers"],
            row_count=project["row_count"],
            preview_data=preview_data
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"预览项目失败: {str(e)}")