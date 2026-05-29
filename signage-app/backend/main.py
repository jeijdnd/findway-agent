"""
FindWay Agent 后端主入口
FastAPI应用，提供API服务
"""
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import RequestValidationError
import uvicorn
import os
from pathlib import Path

from backend.api.projects import router as projects_router
from backend.api.chat import router as chat_router
from backend.api.matching import router as matching_router
from backend.api.compare import router as compare_router
from backend.api.settings import router as settings_router
from backend.api.cad import router as cad_router
from backend.api.api_configs import router as api_configs_router
from backend.api.merge import router as merge_router
from backend.api.scanner import router as scanner_router
from backend.api.files import router as files_router
from backend.api.chat_history import router as chat_history_router
from backend.api.logs import router as logs_router
from backend.api.skills import router as skills_router
from backend.api.safety import router as safety_router
from backend.services.error_log_service import log_exception
from backend.i18n import _

app = FastAPI(
    title="FindWay Agent API",
    description="建筑导视标识设计AI助手后端服务",
    version="0.1.0"
)

# 检测是否是生产模式（前端dist目录存在）
frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
is_production = frontend_dist.exists() and (frontend_dist / "index.html").exists()

# CORS只允许前端开发服务器（开发模式）
if not is_production:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# 核心 API 路由（须在任意条件分支之前注册，确保开发/生产模式均可用）
# chat_history 须在 chat 之前注册，避免历史 API 被其它路由干扰
app.include_router(chat_history_router)
app.include_router(projects_router)
app.include_router(chat_router)
app.include_router(matching_router)
app.include_router(compare_router)
app.include_router(settings_router)
app.include_router(cad_router)
app.include_router(api_configs_router)
app.include_router(merge_router)
app.include_router(scanner_router)
app.include_router(files_router)
app.include_router(logs_router)
app.include_router(skills_router)
app.include_router(safety_router)


def _request_endpoint(request: Request) -> str:
    return f"{request.method} {request.url.path}"


@app.on_event("startup")
async def on_startup():
    """启动时确保用户数据目录存在"""
    from backend.services.app_data import get_app_data_dir
    import os as _os

    data_dir = get_app_data_dir()
    print(_("user_data_dir", path=data_dir))
    print(_("chat_history_path", path=_os.path.join(data_dir, "chat_history.json")))
    print(_("chat_log_path", path=_os.path.join(data_dir, "chat_log.json")))
    print(_("error_log_path", path=_os.path.join(data_dir, "error_log.json")))
    print(_("project_memory_path", path=_os.path.join(data_dir, "projects")))


@app.get("/api/health")
async def health_check():
    """健康检查接口"""
    return {
        "status": "ok",
        "version": "2.0.0",
        "mode": "production" if is_production else "development"
    }


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    log_exception(_request_endpoint(request), exc)
    return JSONResponse(
        status_code=422,
        content={"error": True, "message": str(exc.errors())},
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """HTTP异常处理器"""
    if exc.status_code >= 400:
        log_exception(_request_endpoint(request), exc)
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": True, "message": str(exc.detail)},
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """通用异常处理器"""
    log_exception(_request_endpoint(request), exc)
    return JSONResponse(
        status_code=500,
        content={"error": True, "message": f"服务器内部错误: {str(exc)}"},
    )

# 生产模式：添加静态文件服务
if is_production:
    # 挂载静态文件目录
    app.mount("/assets", StaticFiles(directory=frontend_dist / "assets"), name="static")
    
    # SPA路由：所有非API请求都返回index.html
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """SPA路由处理"""
        # 如果是API路径，不处理
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API endpoint not found")
        
        # 尝试返回请求的文件
        file_path = frontend_dist / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        
        # 否则返回index.html（SPA路由）
        return FileResponse(frontend_dist / "index.html")

if __name__ == "__main__":
    # 从环境变量读取端口，默认8765
    port = int(os.getenv('PORT', 8765))
    
    # 打印启动日志
    mode = _("mode_production") if is_production else _("mode_development")
    print(_("backend_started_port", port=port))
    print(_("mode_label", mode=mode))
    print(_("access_url", url=f"http://127.0.0.1:{port}"))
    print(_("api_docs", url=f"http://127.0.0.1:{port}"))
    
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=port,
        reload=True,
        log_level="info"
    )