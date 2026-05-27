"""
API 异常日志，JSONL 格式存储于 error_log.json
每行: { time, endpoint, error_type, message, traceback }
"""
import json
import os
import traceback
from datetime import datetime
from typing import List, Optional

from backend.services.app_data import get_app_data_dir

MAX_ERROR_LINES = 2000


def _error_file() -> str:
    return os.path.join(get_app_data_dir(), "error_log.json")


def append_error(
    endpoint: str,
    error_type: str,
    message: str,
    tb: Optional[str] = None,
) -> dict:
    entry = {
        "time": datetime.now().isoformat(),
        "endpoint": endpoint,
        "error_type": error_type,
        "message": message,
        "traceback": tb or "",
    }
    path = _error_file()
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    _trim_file()
    return entry


def _trim_file() -> None:
    path = _error_file()
    if not os.path.exists(path):
        return
    try:
        with open(path, "r", encoding="utf-8") as f:
            lines = [ln for ln in f if ln.strip()]
        if len(lines) > MAX_ERROR_LINES:
            lines = lines[-MAX_ERROR_LINES:]
            with open(path, "w", encoding="utf-8") as f:
                f.write("\n".join(lines) + ("\n" if lines else ""))
    except OSError:
        pass


def list_errors(limit: int = 500) -> List[dict]:
    path = _error_file()
    if not os.path.exists(path):
        return []
    entries = []
    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entries.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    except OSError:
        return []
    entries.reverse()
    return entries[:limit]


def clear_errors() -> int:
    path = _error_file()
    count = 0
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                count = sum(1 for ln in f if ln.strip())
            os.remove(path)
        except OSError:
            pass
    return count


def format_errors_report(errors: Optional[List[dict]] = None) -> str:
    items = errors if errors is not None else list_errors(limit=MAX_ERROR_LINES)
    if not items:
        return "暂无错误记录。"
    lines = ["FindWay Agent 错误报告", "=" * 40, ""]
    for i, err in enumerate(items, 1):
        lines.append(f"[{i}] {err.get('time', '')}")
        lines.append(f"  端点: {err.get('endpoint', '')}")
        lines.append(f"  类型: {err.get('error_type', '')}")
        lines.append(f"  消息: {err.get('message', '')}")
        tb = err.get("traceback") or ""
        if tb:
            lines.append(f"  堆栈:\n{tb}")
        lines.append("")
    return "\n".join(lines)


def log_exception(endpoint: str, exc: BaseException) -> dict:
    return append_error(
        endpoint=endpoint,
        error_type=type(exc).__name__,
        message=str(exc),
        tb=traceback.format_exc(),
    )
