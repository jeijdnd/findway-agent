⚠️ 先 git pull

@PROGRESS_BOARD.md

Bug：Electron 能启动了，但 Python 后端报 `ModuleNotFoundError: No module named 'backend'`。

## 诊断

`backend/main.py` 里的导入是：
```python
from backend.api.projects import router
from backend.api.chat import router
```

Python 运行时，当前工作目录是 `signage-app/`，`backend` 确实是子目录。但虚拟环境的 Python 可能需要把 `signage-app` 加到 `sys.path` 才能找到。

## 修复（二选一，推荐方案A）

### 方案A：改 electron/main.js 的 Python 启动（推荐）

在 `startPythonBackend()` 中，spawn 时加环境变量：

```js
pythonProcess = spawn(pythonPath, ['backend/main.py'], {
    cwd: path.join(__dirname, '..'),
    env: {
        ...process.env,
        PYTHONPATH: path.join(__dirname, '..')  // 加这行
    }
});
```

`PYTHONPATH` 设为 `signage-app/`，Python 就能找到 `backend` 包了。

### 方案B：改 backend 所有导入为相对导入

把 `backend/main.py` 等文件中的：
```python
from backend.api.projects import router
```
改为：
```python
from api.projects import router
```

但后端文件较多，方案A更干净。

## 约束
推荐方案A：只改 electron/main.js 一处，加 PYTHONPATH。
如果选方案B，需改 main.py + api/*.py + services/*.py 中所有 `from backend.xxx` 导入。

完成后：git push。
