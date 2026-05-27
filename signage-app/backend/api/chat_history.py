"""
对话记忆持久化 API
数据存储在 %APPDATA%/FindWay-Agent/chat_history.json
"""
import json
import os
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


def get_chat_history_dir() -> str:
    """返回并确保 FindWay-Agent 数据目录存在"""
    appdata = os.environ.get("APPDATA")
    if not appdata:
        appdata = os.environ.get("XDG_CONFIG_HOME") or os.path.expanduser("~")
    dir_path = os.path.join(appdata, "FindWay-Agent")
    os.makedirs(dir_path, exist_ok=True)
    return dir_path


def get_chat_history_file() -> str:
    return os.path.join(get_chat_history_dir(), "chat_history.json")


def _load_all() -> List[dict]:
    path = get_chat_history_file()
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except (json.JSONDecodeError, OSError):
        return []


def _save_all(chats: List[dict]) -> None:
    get_chat_history_dir()
    path = get_chat_history_file()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(chats, f, ensure_ascii=False, indent=2)


def _now_iso() -> str:
    return datetime.now().isoformat()


def _generate_title(messages: List[dict]) -> str:
    for msg in messages:
        if msg.get("role") == "user" and msg.get("content"):
            text = str(msg["content"]).strip()
            if text:
                return text[:30] + ("..." if len(text) > 30 else "")
    return "新对话"


def _make_preview(messages: List[dict]) -> str:
    for msg in reversed(messages):
        if msg.get("content"):
            text = str(msg["content"]).strip().replace("\n", " ")
            if text:
                return text[:60] + ("..." if len(text) > 60 else "")
    return ""


class ChatMessageModel(BaseModel):
    role: str
    content: str
    timestamp: Optional[str] = None


class SaveChatRequest(BaseModel):
    id: Optional[str] = None
    title: Optional[str] = None
    messages: List[ChatMessageModel]


def upsert_chat(
    chat_id: Optional[str],
    messages: List[dict],
    title: Optional[str] = None,
) -> dict:
    """保存或更新一条对话，返回完整对话对象"""
    chats = _load_all()
    now = _now_iso()
    normalized = []
    for m in messages:
        normalized.append({
            "role": m.get("role", "user"),
            "content": m.get("content", ""),
            "timestamp": m.get("timestamp") or now,
        })

    if chat_id:
        for i, chat in enumerate(chats):
            if chat.get("id") == chat_id:
                chat["messages"] = normalized
                chat["title"] = title or chat.get("title") or _generate_title(normalized)
                chat["updated_at"] = now
                chats[i] = chat
                _save_all(chats)
                return chat

    new_id = chat_id or f"chat_{uuid.uuid4().hex[:12]}"
    new_chat = {
        "id": new_id,
        "title": title or _generate_title(normalized),
        "messages": normalized,
        "created_at": now,
        "updated_at": now,
    }
    chats.insert(0, new_chat)
    chats.sort(key=lambda c: c.get("updated_at", ""), reverse=True)
    _save_all(chats)
    return new_chat


def append_exchange(
    chat_id: Optional[str],
    user_content: str,
    assistant_content: str,
) -> dict:
    """追加一轮 user/assistant 消息到对话"""
    chats = _load_all()
    now = _now_iso()
    user_msg = {"role": "user", "content": user_content, "timestamp": now}
    assistant_msg = {"role": "assistant", "content": assistant_content, "timestamp": now}

    if chat_id:
        for i, chat in enumerate(chats):
            if chat.get("id") == chat_id:
                messages = list(chat.get("messages", []))
                messages.extend([user_msg, assistant_msg])
                chat["messages"] = messages
                if not chat.get("title") or chat.get("title") == "新对话":
                    chat["title"] = _generate_title(messages)
                chat["updated_at"] = now
                chats[i] = chat
                chats.sort(key=lambda c: c.get("updated_at", ""), reverse=True)
                _save_all(chats)
                return chat
        # chat_id 由前端传入但尚未落盘时，使用该 id 新建
        new_chat = {
            "id": chat_id,
            "title": _generate_title([user_msg]),
            "messages": [user_msg, assistant_msg],
            "created_at": now,
            "updated_at": now,
        }
        chats.insert(0, new_chat)
        chats.sort(key=lambda c: c.get("updated_at", ""), reverse=True)
        _save_all(chats)
        return new_chat

    new_chat = {
        "id": f"chat_{uuid.uuid4().hex[:12]}",
        "title": _generate_title([user_msg]),
        "messages": [user_msg, assistant_msg],
        "created_at": now,
        "updated_at": now,
    }
    chats.insert(0, new_chat)
    chats.sort(key=lambda c: c.get("updated_at", ""), reverse=True)
    _save_all(chats)
    return new_chat


def get_messages_for_llm(chat_id: Optional[str]) -> List[dict]:
    """获取指定对话的消息（用于 LLM 上下文），不含当前轮"""
    if not chat_id:
        return []
    chats = _load_all()
    for chat in chats:
        if chat.get("id") == chat_id:
            return [
                {"role": m.get("role", "user"), "content": m.get("content", "")}
                for m in chat.get("messages", [])
            ]
    return []


@router.get("/api/chat/history")
async def list_chat_history():
    """返回最近 50 条对话摘要"""
    chats = _load_all()
    chats.sort(key=lambda c: c.get("updated_at", ""), reverse=True)
    result = []
    for chat in chats[:50]:
        messages = chat.get("messages", [])
        result.append({
            "id": chat.get("id"),
            "title": chat.get("title", "新对话"),
            "preview": _make_preview(messages),
            "updated_at": chat.get("updated_at"),
        })
    return {"chats": result}


@router.get("/api/chat/history/{chat_id}")
async def get_chat_by_id(chat_id: str):
    """返回指定对话的全部消息"""
    chats = _load_all()
    for chat in chats:
        if chat.get("id") == chat_id:
            return {
                "id": chat.get("id"),
                "title": chat.get("title"),
                "messages": chat.get("messages", []),
                "created_at": chat.get("created_at"),
                "updated_at": chat.get("updated_at"),
            }
    raise HTTPException(status_code=404, detail="对话不存在")


def _message_to_dict(m: ChatMessageModel) -> dict:
    if hasattr(m, "model_dump"):
        return m.model_dump()
    return m.dict()


@router.post("/api/chat/history")
async def save_chat_history(body: SaveChatRequest):
    """保存或更新对话"""
    messages = [_message_to_dict(m) for m in body.messages]
    chat = upsert_chat(body.id, messages, body.title)
    return {
        "id": chat.get("id"),
        "title": chat.get("title"),
        "messages": chat.get("messages", []),
        "created_at": chat.get("created_at"),
        "updated_at": chat.get("updated_at"),
    }


@router.delete("/api/chat/history/{chat_id}")
async def delete_chat_history(chat_id: str):
    """删除指定对话"""
    chats = _load_all()
    new_chats = [c for c in chats if c.get("id") != chat_id]
    if len(new_chats) == len(chats):
        raise HTTPException(status_code=404, detail="对话不存在")
    _save_all(new_chats)
    return {"success": True}
