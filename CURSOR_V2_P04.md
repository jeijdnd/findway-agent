⚠️ 先执行 git pull（本机可能不是最新代码）

@PROGRESS_BOARD.md

当前：V1全部完成 + V2 T01-T03完成 + P0-3完成。
下一步：V2 P0-4 目录扫描与自动发现。

## 本次任务

### 1. 新建 backend\engine\scanner.py

```python
class DirectoryScanner:
    def scan(self, root_path: str) -> dict:
        """递归扫描根目录，自动发现项目文件夹。
        规则：文件夹内包含 .xlsx 且不含 "~$" 临时文件 → 视为项目目录。
        返回 {"projects": [{"name": "xx", "path": "xx", "file_count": N}, ...]}"""
    
    def is_project_dir(self, dir_path: str) -> bool:
        """判断是否是一个项目目录"""
    
    def quick_scan(self, root_path: str, depth: int = 2) -> dict:
        """浅层快速扫描（depth层内），用于大量目录时加速"""
```

### 2. 新增 backend\api\scanner.py

- `POST /api/scanner/scan`：接收 `{"root_path": "E:\\projects"}` → 返回项目列表
- `POST /api/scanner/register`：选择扫描结果中的项目 → 自动调用 projects API 创建项目卡片
- `GET /api/scanner/config`：读取配置中的默认扫描目录列表

### 3. 修改 Dashboard.jsx

在"新建项目"按钮旁加一个"扫描目录"按钮：
- 弹出输入框：输入目录路径
- 调用 /api/scanner/scan
- 显示扫描结果列表
- 每个结果有"注册"按钮 → 一键创建项目卡片

### 4. 修改 config.json

添加扫描配置：
```json
{"scanner": {"watch_dirs": ["E:\\projects"], "max_depth": 3, "auto_register": false}}
```

## 约束
- 只读不写（不修改被扫描的文件）
- 注册操作仅调用已有的 projects API 创建项目
- 三态覆盖

完成后：更新 PROGRESS_BOARD.md + SESSION_REPORT.md + git push。
