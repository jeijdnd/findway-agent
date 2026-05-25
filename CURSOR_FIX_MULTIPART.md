⚠️ 先 git pull

@PROGRESS_BOARD.md

Bug：Electron 启动后，Python 后端报错 `Form data requires "python-multipart" to be installed.`

## 根因

`compare.py` 用了 `@router.post("/api/compare/upload")` 处理文件上传，FastAPI 需要 `python-multipart` 包，但 `install.bat` 没装这个依赖。

## 修复（两步）

### 1. 安装缺失依赖

在 signage-app/ 目录执行：
```
venv\Scripts\pip install python-multipart
```

### 2. 修改 install.bat 补上这个包

找到第 54 行：
```
pip install fastapi uvicorn openpyxl ezdxf "openai>=1.30.0"
```

改为：
```
pip install fastapi uvicorn openpyxl ezdxf "openai>=1.30.0" python-multipart
```

这样新电脑安装时就不会缺了。

## 约束
- 先手动装 python-multipart 验证
- 再改 install.bat
- 不改其他任何代码

完成后：git push。
