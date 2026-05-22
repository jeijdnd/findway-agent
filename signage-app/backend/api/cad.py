"""
CAD文件API模块
提供DWG/DXF文件读取和预览功能
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import os
from backend.engine.cad_engine import CadEngine

router = APIRouter()

# 初始化CAD引擎
cad_engine = CadEngine()

class CADInfoRequest(BaseModel):
    """CAD信息请求模型"""
    file_path: str

class CADPreviewRequest(BaseModel):
    """CAD预览请求模型"""
    file_path: str
    replacements: Dict[str, str]

class TextInfo(BaseModel):
    """文字信息模型"""
    text: str
    layer: str
    x: float
    y: float

class BlockInfo(BaseModel):
    """图块信息模型"""
    name: str
    layer: str
    count: int

class LayerInfo(BaseModel):
    """图层信息模型"""
    name: str
    on: bool
    frozen: bool
    locked: bool

class CADInfoResponse(BaseModel):
    """CAD信息响应模型"""
    texts: List[TextInfo]
    blocks: List[BlockInfo]
    layers: List[LayerInfo]

class PreviewItem(BaseModel):
    """预览项模型"""
    old: str
    new: str
    layer: str

class CADPreviewResponse(BaseModel):
    """CAD预览响应模型"""
    preview: List[PreviewItem]

@router.post("/api/cad/info", response_model=CADInfoResponse)
async def get_cad_info(request: CADInfoRequest):
    """
    获取DWG/DXF文件信息
    返回图框文字+图块列表+图层一览
    """
    file_path = request.file_path
    
    # 检查文件是否存在
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"文件不存在: {file_path}")
    
    # 检查文件扩展名
    allowed_extensions = ['.dwg', '.dxf']
    file_ext = os.path.splitext(file_path)[1].lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"不支持的文件格式: {file_ext}，仅支持DWG/DXF")
    
    try:
        # 获取所有信息
        info = cad_engine.get_all_info(file_path)
        
        return CADInfoResponse(
            texts=info.get("texts", []),
            blocks=info.get("blocks", []),
            layers=info.get("layers", [])
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"读取DWG文件失败: {str(e)}")

@router.post("/api/cad/preview", response_model=CADPreviewResponse)
async def preview_replace(request: CADPreviewRequest):
    """
    预览图框替换效果
    输入：{"项目名称": "珠海理工", "设计单位": "xxx"}
    输出：{"preview": [{"old": "原项目名", "new": "珠海理工", "layer": "图框"}]}
    不修改原文件。
    """
    file_path = request.file_path
    replacements = request.replacements
    
    # 检查文件是否存在
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"文件不存在: {file_path}")
    
    # 检查文件扩展名
    allowed_extensions = ['.dwg', '.dxf']
    file_ext = os.path.splitext(file_path)[1].lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"不支持的文件格式: {file_ext}，仅支持DWG/DXF")
    
    try:
        # 获取所有文字信息
        texts_result = cad_engine.extract_frame_texts(file_path)
        texts = texts_result.get("texts", [])
        
        preview_items = []
        
        # 遍历所有文字，检查是否需要替换
        for text_info in texts:
            original_text = text_info["text"]
            layer = text_info["layer"]
            
            # 检查每个替换规则
            for key, new_value in replacements.items():
                # 简单的字符串匹配（实际项目中可能需要更复杂的匹配逻辑）
                if key in original_text:
                    replaced_text = original_text.replace(key, new_value)
                    preview_items.append({
                        "old": original_text,
                        "new": replaced_text,
                        "layer": layer
                    })
                    break  # 一个文字只匹配一个替换规则
        
        return CADPreviewResponse(preview=preview_items)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"预览DWG文件失败: {str(e)}")
