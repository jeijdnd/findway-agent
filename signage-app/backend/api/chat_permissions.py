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
    """从用户消息中提取 Windows 目录路径（遇分隔符后的中文叙述即截断）"""
    # 中文文件夹名：非贪婪，在常见叙述词/标点/空格/分隔符前停止
    _cjk_stop = r"(?=这个|路径|下的|其中|里面|看看|\s|[.,;，。；：:!！?？]|$|[\\/])"
    _cjk_folder = rf"[\u4e00-\u9fff]+?{_cjk_stop}"
    # 每段：ASCII 名 + 可选中文后缀，或纯中文段；段间必须有 \ 或 /
    _segment = rf"(?:[A-Za-z0-9_.\-]+(?:{_cjk_folder})?|{_cjk_folder})"
    patterns = [
        rf"[A-Za-z]:\\(?:{_segment}\\)*{_segment}",
        rf"[A-Za-z]:/(?:{_segment}/)*{_segment}",
    ]
    for pattern in patterns:
        match = re.search(pattern, message)
        if match:
            path = match.group(0).rstrip("\\/.,;，。； \t")
            path = os.path.normpath(path)
            if len(path) >= 3:
                return path
    return None


def is_scan_directory_request(message: str) -> bool:
    """判断用户是否在请求扫描/访问目录"""
    text = message.strip()
    lower = text.lower()
    return any(kw in text or kw in lower for kw in SCAN_KEYWORDS)
