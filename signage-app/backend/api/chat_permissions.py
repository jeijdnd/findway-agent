"""
聊天中的目录扫描意图检测与路径提取
"""
import os
import re
from typing import Optional


SCAN_KEYWORDS = [
    "扫描",
    "scan",
    "访问文件夹",
    "访问目录",
    "打开目录",
    "读取目录",
    "浏览文件夹",
    "扫描目录",
    "扫描文件夹",
    "扫描文件",
]


def extract_directory_path(message: str) -> Optional[str]:
    """从用户消息中提取 Windows 目录路径"""
    patterns = [
        r"[A-Za-z]:\\(?:[^\\/:*?\"<>|\r\n]+\\?)*[^\\/:*?\"<>|\r\n]*",
        r"[A-Za-z]:/(?:[^/:*?\"<>|\r\n]+/?)*[^/:*?\"<>|\r\n]*",
    ]
    for pattern in patterns:
        match = re.search(pattern, message)
        if match:
            path = os.path.normpath(match.group(0).rstrip(".,;，。； "))
            if len(path) >= 3:
                return path
    return None


def is_scan_directory_request(message: str) -> bool:
    """判断用户是否在请求扫描/访问目录"""
    text = message.strip()
    lower = text.lower()
    return any(kw in text or kw in lower for kw in SCAN_KEYWORDS)
