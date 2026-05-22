"""
CAD引擎模块
读取DWG/DXF文件，提取标识相关信息
使用ezdxf库（只读，不修改文件）
"""
import ezdxf
import os
from typing import List, Dict, Any

class CadEngine:
    """CAD文件读取引擎"""
    
    def __init__(self):
        """初始化引擎"""
        pass
    
    def extract_frame_texts(self, dwg_path: str) -> Dict[str, Any]:
        """
        提取DWG中所有MTEXT和TEXT实体的文字内容。
        
        Args:
            dwg_path: DWG/DXF文件路径
            
        Returns:
            dict: {"texts": [{"text": "xxx", "layer": "xxx", "x": 0, "y": 0}, ...]}
        """
        if not os.path.exists(dwg_path):
            raise FileNotFoundError(f"文件不存在: {dwg_path}")
        
        try:
            # 尝试打开DWG/DXF文件
            doc = ezdxf.readfile(dwg_path)
            msp = doc.modelspace()
            
            texts = []
            
            # 遍历所有实体
            for entity in msp:
                # 提取TEXT实体
                if entity.dxftype() == "TEXT":
                    text_content = entity.dxf.text if hasattr(entity.dxf, 'text') else ""
                    layer = entity.dxf.layer if hasattr(entity.dxf, 'layer') else "0"
                    x = entity.dxf.insert.x if hasattr(entity.dxf, 'insert') else 0
                    y = entity.dxf.insert.y if hasattr(entity.dxf, 'insert') else 0
                    
                    if text_content.strip():  # 只包含非空文字
                        texts.append({
                            "text": text_content,
                            "layer": layer,
                            "x": x,
                            "y": y
                        })
                
                # 提取MTEXT实体
                elif entity.dxftype() == "MTEXT":
                    text_content = entity.text if hasattr(entity, 'text') else ""
                    layer = entity.dxf.layer if hasattr(entity.dxf, 'layer') else "0"
                    x = entity.dxf.insert.x if hasattr(entity.dxf, 'insert') else 0
                    y = entity.dxf.insert.y if hasattr(entity.dxf, 'insert') else 0
                    
                    if text_content.strip():  # 只包含非空文字
                        texts.append({
                            "text": text_content,
                            "layer": layer,
                            "x": x,
                            "y": y
                        })
            
            return {"texts": texts}
            
        except Exception as e:
            raise Exception(f"读取DWG文件失败: {str(e)}")
    
    def extract_blocks(self, dwg_path: str) -> Dict[str, Any]:
        """
        提取所有BLOCK定义和INSERT引用。
        
        Args:
            dwg_path: DWG/DXF文件路径
            
        Returns:
            dict: {"blocks": [{"name": "xxx", "layer": "xxx", "count": N}, ...]}
        """
        if not os.path.exists(dwg_path):
            raise FileNotFoundError(f"文件不存在: {dwg_path}")
        
        try:
            doc = ezdxf.readfile(dwg_path)
            msp = doc.modelspace()
            
            # 统计块引用次数
            block_stats = {}
            
            # 遍历所有INSERT实体（块引用）
            for entity in msp:
                if entity.dxftype() == "INSERT":
                    block_name = entity.dxf.name if hasattr(entity.dxf, 'name') else "unknown"
                    layer = entity.dxf.layer if hasattr(entity.dxf, 'layer') else "0"
                    
                    # 统计每个块在每个图层的引用次数
                    key = (block_name, layer)
                    if key not in block_stats:
                        block_stats[key] = 0
                    block_stats[key] += 1
            
            # 转换为返回格式
            blocks = []
            for (name, layer), count in block_stats.items():
                if count >= 1:  # 只统计引用次数≥1的块
                    blocks.append({
                        "name": name,
                        "layer": layer,
                        "count": count
                    })
            
            return {"blocks": blocks}
            
        except Exception as e:
            raise Exception(f"读取DWG文件失败: {str(e)}")
    
    def list_layers(self, dwg_path: str) -> Dict[str, Any]:
        """
        返回所有图层名、状态（on/off/frozen/locked）。
        
        Args:
            dwg_path: DWG/DXF文件路径
            
        Returns:
            dict: {"layers": [{"name": "xxx", "on": true, "frozen": false, "locked": false}, ...]}
        """
        if not os.path.exists(dwg_path):
            raise FileNotFoundError(f"文件不存在: {dwg_path}")
        
        try:
            doc = ezdxf.readfile(dwg_path)
            
            layers = []
            # 遍历所有图层
            for layer in doc.layers:
                layer_name = layer.dxf.name if hasattr(layer.dxf, 'name') else "unknown"
                is_on = layer.is_on() if hasattr(layer, 'is_on') else True
                is_frozen = layer.is_frozen() if hasattr(layer, 'is_frozen') else False
                is_locked = layer.is_locked() if hasattr(layer, 'is_locked') else False
                
                layers.append({
                    "name": layer_name,
                    "on": is_on,
                    "frozen": is_frozen,
                    "locked": is_locked
                })
            
            return {"layers": layers}
            
        except Exception as e:
            raise Exception(f"读取DWG文件失败: {str(e)}")
    
    def get_all_info(self, dwg_path: str) -> Dict[str, Any]:
        """
        获取DWG文件的所有信息（文字、图块、图层）。
        
        Args:
            dwg_path: DWG/DXF文件路径
            
        Returns:
            dict: 包含texts、blocks、layers的完整信息
        """
        texts_result = self.extract_frame_texts(dwg_path)
        blocks_result = self.extract_blocks(dwg_path)
        layers_result = self.list_layers(dwg_path)
        
        return {
            "texts": texts_result.get("texts", []),
            "blocks": blocks_result.get("blocks", []),
            "layers": layers_result.get("layers", [])
        }
