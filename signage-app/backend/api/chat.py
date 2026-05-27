"""
聊天API模块
提供对话接口，Function Calling 后端执行工具并回传结果
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, AsyncGenerator, Dict, Any
import json

from backend.services.llm_engine import llm_engine
from backend.api.chat_history import (
    append_exchange,
    get_messages_for_llm,
)
from backend.services.chat_log_service import append_chat_log
from backend.services.project_memory import project_memory
from backend.skills import skill_manager
from backend.services.safety_auditor import safety_auditor
from backend.i18n import _

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
    if api_config_id:
        if llm_engine.get_config_by_id(api_config_id):
            return api_config_id
        return None
    default_config = llm_engine.get_default_config()
    return default_config.get("id") if default_config else None


def _ensure_llm_api_key(api_config_id: Optional[str] = None) -> Optional[str]:
    resolved_id = _resolve_chat_api_config_id(api_config_id)
    if not resolved_id:
        return None
    api_config = llm_engine.resolve_api_config(resolved_id)
    if not api_config or not api_config.get("api_key"):
        return None
    return resolved_id


async def _execute_tool(
    name: str,
    args: Dict[str, Any],
    api_config_id: Optional[str] = None,
    user_bypass: bool = False,
) -> Dict[str, Any]:
    """Agent A 执行前经 Agent B（safety_auditor）审核。"""
    audit = await safety_auditor.audit(
        name, args, user_bypass=user_bypass, api_config_id=api_config_id
    )
    if not audit.allowed:
        return {
            "success": False,
            "blocked": True,
            "audit_id": audit.audit_id,
            "reason": audit.reason,
            "risk_level": audit.risk_level,
            "skill_name": name,
            "parameters": args,
            "message": f"操作被安全审核拦截: {audit.reason}",
        }
    return await skill_manager.execute(name, **args)


def _make_tool_executor(api_config_id: Optional[str] = None):
    async def _executor(name: str, args: Dict[str, Any]) -> Dict[str, Any]:
        return await _execute_tool(name, args, api_config_id=api_config_id)

    return _executor


def _primary_action(actions: List[str]) -> Optional[str]:
    if not actions:
        return None
    return actions[0]


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
        print(_("chat_log_write_failed", error=e))


@router.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """聊天接口：LLM Function Calling + 后端执行技能 + 结果回传"""
    try:
        stored = get_messages_for_llm(request.chat_id)
        history_dicts = project_memory.get_context_history(
            request.project_id, stored, max_rounds=5
        )
        if request.project_id:
            project_memory.ensure_project_dir(request.project_id)

        api_config_id = _ensure_llm_api_key(request.api_config_id)
        if not api_config_id:
            reply = "错误：API密钥未配置，请设置环境变量 LLM_API_KEY 或在设置中填写 api_key"
            _record_chat_log(request.message, reply, request.chat_id)
            return ChatResponse(reply=reply, action=None, data=None)

        result = await llm_engine.chat(
            message=request.message,
            history=history_dicts,
            api_config_id=api_config_id,
            project_id=request.project_id,
            tool_executor=_make_tool_executor(api_config_id),
        )
        reply = result.reply
        action = _primary_action(result.actions)
        action_data = dict(result.action_data)
        if action_data.get("safety_blocked"):
            resp_blocked = action_data["safety_blocked"]
            if not reply or "拦截" not in reply:
                reply = (
                    reply
                    + f"\n\n⚠ 安全审核拦截: {resp_blocked.get('reason', '')}"
                ).strip()

        project_memory.append_exchange(
            request.project_id, request.message, reply
        )
        project_memory.schedule_memory_update(
            request.project_id,
            request.message,
            reply,
            api_config_id,
        )

        saved = append_exchange(request.chat_id, request.message, reply)
        resp_data = {**action_data, "chat_id": saved.get("id")}
        if result.tools_called:
            resp_data["tools_called"] = result.tools_called
        if result.action_data.get("repos") is not None:
            resp_data["tool_discovery"] = {
                "found": result.action_data.get("found", False),
                "repos": result.action_data.get("repos", []),
                "query": result.action_data.get("query", ""),
            }
        if result.action_data.get("suggest_github_search"):
            resp_data["suggest_github_search"] = True
            resp_data["missing_tool"] = result.action_data.get("missing_tool")
        if result.action_data.get("safety_blocked"):
            resp_data["safety_blocked"] = result.action_data["safety_blocked"]

        _record_chat_log(
            request.message, reply, saved.get("id"), action, resp_data
        )
        return ChatResponse(reply=reply, action=action, data=resp_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"聊天处理失败: {str(e)}")


@router.post("/api/chat/stream")
async def chat_stream(request: StreamChatRequest):
    """流式聊天接口（工具调用后输出最终回复）"""
    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            if request.history is not None:
                raw_history = [
                    {"role": m.get("role", "user"), "content": m.get("content", "")}
                    for m in request.history
                ]
                history_dicts = project_memory.get_context_history(
                    request.project_id, raw_history, max_rounds=5
                )
            else:
                stored = get_messages_for_llm(request.chat_id)
                history_dicts = project_memory.get_context_history(
                    request.project_id, stored, max_rounds=5
                )

            if request.project_id:
                project_memory.ensure_project_dir(request.project_id)

            api_config_id = _ensure_llm_api_key(request.api_config_id)
            if not api_config_id:
                yield f'data: {json.dumps({"type": "error", "content": "错误：API密钥未配置，请设置环境变量 LLM_API_KEY 或在设置中填写 api_key"}, ensure_ascii=False)}\n\n'
                return

            result = await llm_engine.chat(
                message=request.message,
                history=history_dicts,
                api_config_id=api_config_id,
                project_id=request.project_id,
                tool_executor=_make_tool_executor(api_config_id),
            )
            full_reply = result.reply
            for char in full_reply:
                yield f'data: {json.dumps({"type": "token", "content": char}, ensure_ascii=False)}\n\n'
            action = _primary_action(result.actions)

            project_memory.append_exchange(
                request.project_id, request.message, full_reply
            )
            project_memory.schedule_memory_update(
                request.project_id,
                request.message,
                full_reply,
                api_config_id,
            )

            saved = append_exchange(request.chat_id, request.message, full_reply)

            metadata = {
                "action": action,
                "project_id": request.project_id,
                "chat_id": saved.get("id"),
            }
            metadata.update(result.action_data)
            if result.tools_called:
                metadata["tools_called"] = result.tools_called
            if result.action_data.get("repos") is not None:
                metadata["tool_discovery"] = {
                    "found": result.action_data.get("found", False),
                    "repos": result.action_data.get("repos", []),
                    "query": result.action_data.get("query", ""),
                }
            if result.action_data.get("suggest_github_search"):
                metadata["suggest_github_search"] = True
            if result.action_data.get("safety_blocked"):
                metadata["safety_blocked"] = result.action_data["safety_blocked"]
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
