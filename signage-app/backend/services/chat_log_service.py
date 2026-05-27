"""
对话请求/响应日志，存储于 chat_log.json
"""
import json
import os
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from backend.services.app_data import get_app_data_dir

MAX_LOG_ENTRIES = 5000


def _log_file() -> str:
    return os.path.join(get_app_data_dir(), "chat_log.json")


def _load_all() -> List[dict]:
    path = _log_file()
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except (json.JSONDecodeError, OSError):
        return []


def _save_all(entries: List[dict]) -> None:
    path = _log_file()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)


def append_chat_log(
    request_message: str,
    response_reply: str,
    chat_id: Optional[str] = None,
    action: Optional[str] = None,
    data: Optional[Dict[str, Any]] = None,
) -> dict:
    entry = {
        "id": f"log_{uuid.uuid4().hex[:12]}",
        "time": datetime.now().isoformat(),
        "chat_id": chat_id,
        "request_message": request_message,
        "response_reply": response_reply,
        "action": action,
        "data": data or {},
    }
    logs = _load_all()
    logs.insert(0, entry)
    if len(logs) > MAX_LOG_ENTRIES:
        logs = logs[:MAX_LOG_ENTRIES]
    _save_all(logs)
    return entry


def list_chat_logs(query: Optional[str] = None, limit: int = 500) -> List[dict]:
    logs = _load_all()
    if query:
        q = query.strip().lower()
        logs = [
            log
            for log in logs
            if q in (log.get("request_message") or "").lower()
            or q in (log.get("response_reply") or "").lower()
            or q in (log.get("action") or "").lower()
        ]
    return logs[:limit]


def clear_chat_logs() -> int:
    count = len(_load_all())
    _save_all([])
    return count
