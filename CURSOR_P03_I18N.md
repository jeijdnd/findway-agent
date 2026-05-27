## Cursor: P3 — 国际化（i18n）

@PROGRESS_BOARD.md

### 需求
代码纯英文 + 外挂中文翻译 JSON，根治乱码。

### 实现

#### backend/i18n/zh-CN.json
```json
{
  "backend_starting": "正在启动后端...",
  "backend_ready": "后端已就绪: {url}",
  "backend_error": "后端启动失败: {error}",
  "scan_complete": "扫描完成，共 {count} 个项目",
  "permission_denied": "权限不足: {reason}",
  "electron_launching": "正在启动桌面应用..."
}
```

#### backend/i18n/loader.py
```python
import json, os, locale

STRINGS_DIR = os.path.join(os.path.dirname(__file__))

def load(lang="zh-CN"):
    with open(os.path.join(STRINGS_DIR, f"{lang}.json"), encoding="utf-8") as f:
        return json.load(f)

_t = load()

def _(key, **kwargs):
    return _t.get(key, key).format(**kwargs)
```

#### 修改点
- main.py：print 改用 i18n
- electron/main.js：console.log 改用 i18n
- desktop.bat：echo 改用 i18n
- chat.py / scanner.py 关键输出：用 i18n

### 约束
- 不删除任何中文注释
- 只改输出层（print/console.log/echo）
- JSON 用 UTF-8 编码保存

完成后 git push。
