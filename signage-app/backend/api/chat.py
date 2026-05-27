"""
聊天API模块
提供对话接口，支持LLM对话引擎，流式输出
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, AsyncGenerator
import json

from backend.services.llm_engine import llm_engine
from backend.api.chat_history import (
    append_exchange,
    get_messages_for_llm,
)
from backend.api.chat_permissions import (
    extract_directory_path,
    is_scan_directory_request,
)
from backend.services.chat_log_service import append_chat_log

router = APIRouter()

class ChatMessage(BaseModel):
    """聊天消息数据模型"""
    role: str
    content: str
    timestamp: str

class ChatRequest(BaseModel):
    """聊天请求数据模型"""
    message: str
    project_id: Optional[str] = None
    api_config_id: Optional[str] = None
    chat_id: Optional[str] = None


class StreamChatRequest(BaseModel):
    """流式聊天请求数据模型"""
    message: str
    project_id: Optional[str] = None
    api_config_id: Optional[str] = None
    chat_id: Optional[str] = None
    history: Optional[List[dict]] = None


class ChatResponse(BaseModel):
    """聊天响应数据模型"""
    reply: str
    action: Optional[str] = None
    data: Optional[dict] = None

def _resolve_chat_api_config_id(api_config_id: Optional[str] = None) -> Optional[str]:
    """解析本次对话应使用的 API 配置 ID（请求未指定时使用 default_api）"""
    if api_config_id:
        if llm_engine.get_config_by_id(api_config_id):
            return api_config_id
        return None

    default_config = llm_engine.get_default_config()
    return default_config.get("id") if default_config else None


def _ensure_llm_api_key(api_config_id: Optional[str] = None) -> Optional[str]:
    """校验 LLM API Key 是否可用，返回解析后的配置 ID"""
    resolved_id = _resolve_chat_api_config_id(api_config_id)
    if not resolved_id:
        return None

    api_config = llm_engine.resolve_api_config(resolved_id)
    if not api_config or not api_config.get("api_key"):
        return None
    return resolved_id


def _record_chat_log(
    request_message: str,
    reply: str,
    chat_id: Optional[str] = None,
    action: Optional[str] = None,
    data: Optional[dict] = None,
) -> None:
    try:
        append_chat_log(
            request_message=request_message,
            response_reply=reply,
            chat_id=chat_id,
            action=action,
            data=data,
        )
    except Exception as e:
        print(f"写入对话日志失败: {e}")


@router.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """聊天接口，接收用户消息，返回AI回复（非流式）"""
    try:
        # 目录扫描：先走权限确认，由前端调用 request-permission
        if is_scan_directory_request(request.message):
            scan_path = extract_directory_path(request.message)
            if not scan_path:
                reply = "请提供要扫描的目录完整路径，例如：D:\\Projects"
                saved = append_exchange(request.chat_id, request.message, reply)
                cid = saved.get("id")
                _record_chat_log(request.message, reply, cid, None, {"chat_id": cid})
                return ChatResponse(
                    reply=reply,
                    action=None,
                    data={"chat_id": cid},
                )
            reply = (
                f"需要扫描目录：{scan_path}\n"
                "请在弹出的确认框中授权；拒绝后将回复「已取消」。"
            )
            saved = append_exchange(request.chat_id, request.message, reply)
            cid = saved.get("id")
            resp_data = {"path": scan_path, "chat_id": cid}
            _record_chat_log(
                request.message, reply, cid, "scan_directory", resp_data
            )
            return ChatResponse(
                reply=reply,
                action="scan_directory",
                data=resp_data,
            )

        stored = get_messages_for_llm(request.chat_id)
        history_dicts = stored

        api_config_id = _ensure_llm_api_key(request.api_config_id)
        if not api_config_id:
            reply = "错误：API密钥未配置，请设置环境变量 LLM_API_KEY 或在设置中填写 api_key"
            _record_chat_log(request.message, reply, request.chat_id)
            return ChatResponse(reply=reply, action=None, data=None)

        # 使用LLM引擎获取回复（传入已解析的 api_config_id，确保 api_key 生效）
        reply = await llm_engine.chat(
            message=request.message,
            history=history_dicts,
            api_config_id=api_config_id
        )
        
        # 推断意图
        intent = await llm_engine.infer_intent(message=request.message, history=history_dicts)
        
        # 根据意图设置action和data
        action = None
        data = None
        if intent == "create_project":
            action = "create_project"
            data = {}
        elif intent == "search_old_project":
            action = "search_old_project"
            data = {}
        elif intent == "compare_list":
            action = "compare_list"
            data = {}
        elif intent == "query_spec":
            action = "query_spec"
            data = {}
        elif intent == "merge_tuding":
            action = "merge_tuding"
            data = {}
        
        saved = append_exchange(request.chat_id, request.message, reply)
        resp_data = {**(data or {}), "chat_id": saved.get("id")}
        _record_chat_log(
            request.message, reply, saved.get("id"), action, resp_data
        )
        return ChatResponse(reply=reply, action=action, data=resp_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"聊天处理失败: {str(e)}")


@router.post("/api/chat/stream")
async def chat_stream(request: StreamChatRequest):
    """流式聊天接口，返回 text/event-stream"""
    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            # 优先使用请求中的 history，否则从持久化记录加载
            if request.history is not None:
                history_dicts = [
                    {"role": m.get("role", "user"), "content": m.get("content", "")}
                    for m in request.history
                ]
            else:
                history_dicts = get_messages_for_llm(request.chat_id)

            api_config_id = _ensure_llm_api_key(request.api_config_id)
            if not api_config_id:
                yield f'data: {json.dumps({"type": "error", "content": "错误：API密钥未配置，请设置环境变量 LLM_API_KEY 或在设置中填写 api_key"}, ensure_ascii=False)}\n\n'
                return

            full_reply = ""
            async for token in llm_engine.chat_stream(
                message=request.message,
                history=history_dicts,
                api_config_id=api_config_id,
            ):
                full_reply += token
                yield f'data: {json.dumps({"type": "token", "content": token}, ensure_ascii=False)}\n\n'

            # 推断意图
            intent = await llm_engine.infer_intent(message=request.message, history=history_dicts)

            saved = append_exchange(request.chat_id, request.message, full_reply)

            metadata = {
                "intent": intent,
                "action": intent if intent != "general" else None,
                "project_id": request.project_id,
                "chat_id": saved.get("id"),
            }
            yield f'data: {json.dumps({"type": "done", "metadata": metadata}, ensure_ascii=False)}\n\n'

        except Exception as e:
            yield f'data: {json.dumps({"type": "error", "content": f"聊天处理失败: {str(e)}"}, ensure_ascii=False)}\n\n'

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/api/chat/models")
async def get_chat_models():
    """返回所有已启用API的 {id, name, model} 列表"""
    try:
        configs = llm_engine.get_active_configs()
        return {
            "models": [
                {"id": c["id"], "name": c.get("name", c["id"]), "model": c.get("model", "")}
                for c in configs
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取模型列表失败: {str(e)}")

