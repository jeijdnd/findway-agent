"""
i18n loader: English keys in code, UTF-8 JSON for localized output strings.
"""
import json
import os
from typing import Any, Dict, Optional

STRINGS_DIR = os.path.dirname(os.path.abspath(__file__))
_DEFAULT_LANG = "zh-CN"


def _resolve_lang(lang: Optional[str] = None) -> str:
    if lang:
        return lang
    env = os.environ.get("FINDWAY_LANG", "").strip()
    if env:
        return env
    return _DEFAULT_LANG


def load(lang: Optional[str] = None) -> Dict[str, str]:
    code = _resolve_lang(lang)
    path = os.path.join(STRINGS_DIR, f"{code}.json")
    if not os.path.isfile(path):
        return {}
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return data if isinstance(data, dict) else {}


_t: Dict[str, str] = load()


def reload(lang: Optional[str] = None) -> None:
    global _t
    _t = load(lang)


def _(key: str, **kwargs: Any) -> str:
    template = _t.get(key, key)
    if not kwargs:
        return template
    try:
        return template.format(**kwargs)
    except (KeyError, ValueError):
        return template
