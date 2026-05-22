"""
FindWay Agent 后端主入口
FastAPI应用，提供API服务
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

from backend.api.projects import router as projects_router
from backend.api.chat import router as chat_router
from backend.api.matching import router as matching_router
from backend.api.compare import router as compare_router
from backend.api.settings import router as settings_router
from backend.api.cad import router as cad_router

app = FastAPI(
    title="FindWay Agent API",
    description="建筑导视标识设计AI助手后端服务",
    version="0.1.0"
)

# CORS只允许前端开发服务器
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(projects_router)
app.include_router(chat_router)
app.include_router(matching_router)
app.include_router(compare_router)
app.include_router(settings_router)
app.include_router(cad_router)

@app.get("/api/health")
async def health_check():
    """健康检查接口"""
    return {"status": "ok", "message": "FindWay Agent API运行正常"}

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """HTTP异常处理器"""
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": True, "message": str(exc.detail)}
    )

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """通用异常处理器"""
    return JSONResponse(
        status_code=500,
        content={"error": True, "message": f"服务器内部错误: {str(exc)}"}
    )

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8765,
        reload=True,
        log_level="info"
    )