"""
聊天API模块
提供对话接口，支持LLM对话引擎，流式输出
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, AsyncGenerator
import json
import os
from datetime import datetime

from backend.services.llm_engine import llm_engine

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


class StreamChatRequest(BaseModel):
    """流式聊天请求数据模型"""
    message: str
    project_id: Optional[str] = None
    api_config_id: Optional[str] = None
    history: Optional[List[dict]] = None


class ChatResponse(BaseModel):
    """聊天响应数据模型"""
    reply: str
    action: Optional[str] = None
    data: Optional[dict] = None

CHAT_HISTORY_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "chat_history.json")

def load_chat_history(project_id: str = None) -> List[ChatMessage]:
    """加载聊天历史"""
    try:
        if os.path.exists(CHAT_HISTORY_PATH):
            with open(CHAT_HISTORY_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                key = project_id or "default"
                return [ChatMessage(**msg) for msg in data.get(key, [])]
    except Exception:
        pass
    return []

def save_chat_history(messages: List[ChatMessage], project_id: str = None):
    """保存聊天历史"""
    try:
        data = {}
        if os.path.exists(CHAT_HISTORY_PATH):
            with open(CHAT_HISTORY_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
        key = project_id or "default"
        data[key] = [msg.dict() for msg in messages]
        os.makedirs(os.path.dirname(CHAT_HISTORY_PATH), exist_ok=True)
        with open(CHAT_HISTORY_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"保存聊天历史失败: {e}")


@router.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """聊天接口，接收用户消息，返回AI回复（非流式）"""
    try:
        history = load_chat_history(request.project_id)
        user_message = ChatMessage(
            role="user",
            content=request.message,
            timestamp=datetime.now().isoformat()
        )
        history.append(user_message)
        
        # 转换历史记录为字典格式
        history_dicts = [{"role": msg.role, "content": msg.content} for msg in history[:-1]]  # 排除当前用户消息
        
        # 使用LLM引擎获取回复
        reply = await llm_engine.chat(
            message=request.message,
            history=history_dicts,
            api_config_id=request.api_config_id
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
        
        assistant_message = ChatMessage(
            role="assistant",
            content=reply,
            timestamp=datetime.now().isoformat()
        )
        history.append(assistant_message)
        save_chat_history(history, request.project_id)
        return ChatResponse(reply=reply, action=action, data=data)
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
                stored = load_chat_history(request.project_id)
                history_dicts = [{"role": msg.role, "content": msg.content} for msg in stored]

            full_reply = ""
            async for token in llm_engine.chat_stream(
                message=request.message,
                history=history_dicts,
                api_config_id=request.api_config_id,
            ):
                full_reply += token
                yield f'data: {json.dumps({"type": "token", "content": token}, ensure_ascii=False)}\n\n'

            # 推断意图
            intent = await llm_engine.infer_intent(message=request.message, history=history_dicts)

            # 保存对话历史
            history = load_chat_history(request.project_id)
            history.append(ChatMessage(
                role="user",
                content=request.message,
                timestamp=datetime.now().isoformat(),
            ))
            history.append(ChatMessage(
                role="assistant",
                content=full_reply,
                timestamp=datetime.now().isoformat(),
            ))
            save_chat_history(history, request.project_id)

            metadata = {
                "intent": intent,
                "action": intent if intent != "general" else None,
                "project_id": request.project_id,
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


@router.get("/api/chat/history")
async def get_chat_history(project_id: Optional[str] = None):
    """获取聊天历史"""
    try:
        history = load_chat_history(project_id)
        return {"history": [msg.dict() for msg in history]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取聊天历史失败: {str(e)}")