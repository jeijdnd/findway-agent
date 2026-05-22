@PROGRESS_BOARD.md @TECH_DECISIONS.md

当前进度：Phase 0-2 完成。开始 Phase 3：清单差异对比。

## 本次任务（Phase 3）

### 3.1 后端：Excel读取引擎
创建 `signage-app\backend\engine\excel_engine.py`：

```python
class ExcelEngine:
    def read_signage_list(self, file_path, sheet_name=None):
        """读取标识清单Excel，提取结构化数据。
        自动识别表头行，返回列名+数据行列表"""
    
    def detect_structure(self, file_path):
        """返回所有sheet名+每个sheet的列名+前3行预览"""
```

### 3.2 后端：差异对比引擎
创建 `signage-app\backend\engine\differ.py`：

```python
class ListDiffer:
    def compare(self, list_a, list_b, key_field="编号"):
        """按key_field匹配两表行。
        返回四类：added(新增)/removed(删除)/modified(修改)/unchanged(不变)
        修改项标注 changed_fields"""
```

### 3.3 后端：对比API
修改 `signage-app\backend\api\compare.py`（新建）：
- `POST /api/compare`：接收两个文件上传 → 对比 → 返回差异JSON
- `GET /api/compare/export`：返回差异Excel下载

### 3.4 前端：对比页面
创建 `signage-app\frontend\src\pages\Compare.jsx`：
- 两个拖放区（旧版清单 / 新版清单）
- 上传后自动对比
- 差异表格（新增绿/删除红/修改黄）
- 变化汇总卡片 + "导出报告"按钮
- Loading/Empty/Error 三态覆盖

### 对话联动
在 `chat.py` 增强 `compare_list` 意图：引导用户上传文件。

## 完成后
更新 PROGRESS_BOARD.md 和 SESSION_REPORT.md。
