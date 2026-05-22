@PROGRESS_BOARD.md

当前：Phase 0-4完成，开始 Phase 5 CAD辅助。

## 本次任务（Phase 5）

### 5.1 重写 backend\engine\cad_engine.py

这个文件目前是占位符，需要实现真功能。用 ezdxf 库（已在requirements中安装）。

```python
class CadEngine:
    def extract_frame_texts(self, dwg_path: str) -> dict:
        """
        提取DWG中所有MTEXT和TEXT实体的文字内容。
        返回 {"texts": [{"text": "xxx", "layer": "xxx", "x": 0, "y": 0}, ...]}
        只读，不修改文件。
        """

    def extract_blocks(self, dwg_path: str) -> dict:
        """
        提取所有BLOCK定义和INSERT引用。
        返回 {"blocks": [{"name": "xxx", "layer": "xxx", "count": N}, ...]}
        只统计引用次数≥1的块。
        """

    def list_layers(self, dwg_path: str) -> dict:
        """
        返回所有图层名、状态（on/off/frozen/locked）。
        """
```

### 5.2 新建 backend\api\cad.py

```python
router = APIRouter()

@router.post("/api/cad/info")
async def get_cad_info(file_path: str):
    """上传DWG路径，返回图框文字+图块列表+图层一览"""
    # 调用 CadEngine 的三个方法，合并返回

@router.post("/api/cad/preview")
async def preview_replace(file_path: str, replacements: dict):
    """
    预览图框替换效果。
    输入：{"项目名称": "珠海理工", "设计单位": "xxx"}
    输出：{"preview": [{"old": "原项目名", "new": "珠海理工", "layer": "图框"}]}
    不修改原文件。
    """
```

### 5.3 注册路由

在 `backend\main.py` 中添加 `from backend.api.cad import router as cad_router` 和 `app.include_router(cad_router)`。

### 5.4 前端（最小化）

在 AppLayout.jsx 的 CAD 标签页只做一个简单的文件选择器：
- 输入DWG文件路径
- "读取信息"按钮 → POST /api/cad/info → 显示结果表格
- 不需要复杂的拖拽上传，纯路径输入即可

## 重要约束
- **只读**：不修改任何DWG文件
- **用ezdxf**：不是cad-viewer
- **格式支持**：DXF肯定支持，DWG需要ezdxf的odafc插件

## 完成后
更新 PROGRESS_BOARD.md 和 SESSION_REPORT.md。
git add -A && git commit -m "Phase 5: CAD辅助-DWG读取" && git push
