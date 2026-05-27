"""
安全审核日志，存储于 %APPDATA%/FindWay-Agent/safety_log.json
"""
import json
import os
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from backend.services.app_data import get_app_data_dir

MAX_LOG_ENTRIES = 50


def _log_file() -> str:
    return os.path.join(get_app_data_dir(), "safety_log.json")


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
    with open(_log_file(), "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)


def append_safety_log(
    skill_name: str,
    parameters: Dict[str, Any],
    allowed: bool,
    reason: str = "",
    risk_level: str = "low",
    auditor: str = "rules",
    user_bypass: bool = False,
) -> dict:
    entry = {
        "id": f"safety_{uuid.uuid4().hex[:12]}",
        "time": datetime.now().isoformat(),
        "skill_name": skill_name,
        "parameters": parameters,
        "allowed": allowed,
        "reason": reason,
        "risk_level": risk_level,
        "auditor": auditor,
        "user_bypass": user_bypass,
    }
    logs = _load_all()
    logs.insert(0, entry)
    logs = logs[:MAX_LOG_ENTRIES]
    _save_all(logs)
    return entry


def list_safety_logs(limit: int = MAX_LOG_ENTRIES) -> List[dict]:
    return _load_all()[:limit]


def clear_safety_logs() -> int:
    count = len(_load_all())
    _save_all([])
    return count
