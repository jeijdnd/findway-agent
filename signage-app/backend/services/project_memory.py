"""
项目级记忆：memory.md 摘要 + 按项目 chat.json + 上下文压缩
"""
import asyncio
import json
import os
import re
from datetime import datetime
from typing import Any, Dict, List, Optional

from backend.services.app_data import get_app_data_dir
from backend.i18n import _


def _safe_slug(name: str) -> str:
    slug = re.sub(r'[<>:"/\\|?*]', "_", (name or "").strip())
    slug = slug.strip(". ") or "unnamed"
    return slug[:80]


def _projects_root() -> str:
    root = os.path.join(get_app_data_dir(), "projects")
    os.makedirs(root, exist_ok=True)
    return root


def resolve_project_slug(project_id: Optional[str]) -> str:
    """将 project_id 解析为项目目录名；无项目时用 general"""
    if not project_id:
        return "general"
    try:
        from backend.api.projects import load_projects

        for p in load_projects():
            if p.get("id") == project_id:
                return _safe_slug(p.get("name") or project_id)
    except Exception:
        pass
    return _safe_slug(project_id)


def ensure_project_dir(project_id: Optional[str]) -> str:
    slug = resolve_project_slug(project_id)
    path = os.path.join(_projects_root(), slug)
    os.makedirs(path, exist_ok=True)
    return path


def get_memory_path(project_id: Optional[str]) -> str:
    return os.path.join(ensure_project_dir(project_id), "memory.md")


def get_chat_path(project_id: Optional[str]) -> str:
    return os.path.join(ensure_project_dir(project_id), "chat.json")


def read_memory_md(project_id: Optional[str]) -> str:
    path = get_memory_path(project_id)
    if not os.path.isfile(path):
        return ""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read().strip()
    except OSError:
        return ""


def write_memory_md(project_id: Optional[str], content: str) -> None:
    path = get_memory_path(project_id)
    ensure_project_dir(project_id)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")


def _load_project_chat(project_id: Optional[str]) -> List[dict]:
    path = get_chat_path(project_id)
    if not os.path.isfile(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except (json.JSONDecodeError, OSError):
        return []


def _save_project_chat(project_id: Optional[str], messages: List[dict]) -> None:
    path = get_chat_path(project_id)
    ensure_project_dir(project_id)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(messages, f, ensure_ascii=False, indent=2)


def compress_history(
    messages: List[Dict[str, str]], max_rounds: int = 5
) -> List[Dict[str, str]]:
    """保留最近 max_rounds 轮对话（一轮 = user + assistant）"""
    if not messages or max_rounds <= 0:
        return []
    pairs: List[List[Dict[str, str]]] = []
    current: List[Dict[str, str]] = []
    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role == "user":
            if current:
                pairs.append(current)
            current = [{"role": "user", "content": content}]
        elif role == "assistant" and current:
            current.append({"role": "assistant", "content": content})
            pairs.append(current)
            current = []
        else:
            current.append({"role": role, "content": content})
    if current:
        pairs.append(current)
    recent = pairs[-max_rounds:]
    flat: List[Dict[str, str]] = []
    for pair in recent:
        flat.extend(pair)
    return flat


def get_context_history(
    project_id: Optional[str],
    global_messages: List[Dict[str, str]],
    max_rounds: int = 5,
) -> List[Dict[str, str]]:
    """
    合并项目 chat.json 与全局历史，压缩为最近 N 轮供 LLM 使用。
    优先使用条数更多的来源。
    """
    project_msgs = _load_project_chat(project_id)
    source = project_msgs if len(project_msgs) >= len(global_messages) else global_messages
    return compress_history(source, max_rounds=max_rounds)


def append_exchange(
    project_id: Optional[str],
    user_content: str,
    assistant_content: str,
) -> None:
    """追加一轮对话到项目 chat.json"""
    now = datetime.now().isoformat()
    messages = _load_project_chat(project_id)
    messages.append(
        {"role": "user", "content": user_content, "timestamp": now}
    )
    messages.append(
        {"role": "assistant", "content": assistant_content, "timestamp": now}
    )
    _save_project_chat(project_id, messages)


async def summarize_memory_async(
    project_id: Optional[str],
    user_message: str,
    assistant_reply: str,
    api_config_id: Optional[str] = None,
) -> None:
    """异步调用 summarize_memory 技能更新 memory.md"""
    from backend.skills import skill_manager

    slug = resolve_project_slug(project_id)
    current = read_memory_md(project_id)
    try:
        result = await skill_manager.execute(
            "summarize_memory",
            project_slug=slug,
            user_message=user_message,
            assistant_reply=assistant_reply,
            current_memory=current,
            api_config_id=api_config_id,
        )
        if result.get("success") and result.get("memory_md"):
            write_memory_md(project_id, result["memory_md"])
    except Exception as e:
        print(_("project_memory_update_failed", slug=slug, error=e))


def schedule_memory_update(
    project_id: Optional[str],
    user_message: str,
    assistant_reply: str,
    api_config_id: Optional[str] = None,
) -> None:
    """在后台事件循环中调度记忆摘要（不阻塞响应）"""
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(
            summarize_memory_async(
                project_id, user_message, assistant_reply, api_config_id
            )
        )
    except RuntimeError:
        asyncio.run(
            summarize_memory_async(
                project_id, user_message, assistant_reply, api_config_id
            )
        )


class ProjectMemoryService:
    read_memory_md = staticmethod(read_memory_md)
    get_context_history = staticmethod(get_context_history)
    append_exchange = staticmethod(append_exchange)
    schedule_memory_update = staticmethod(schedule_memory_update)
    ensure_project_dir = staticmethod(ensure_project_dir)
    resolve_project_slug = staticmethod(resolve_project_slug)


project_memory = ProjectMemoryService()
