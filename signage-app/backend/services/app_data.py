"""
用户数据目录 %APPDATA%/FindWay-Agent/
"""
import json
import os


def get_app_data_dir() -> str:
    appdata = os.environ.get("APPDATA")
    if not appdata:
        appdata = os.environ.get("XDG_CONFIG_HOME") or os.path.expanduser("~")
    dir_path = os.path.join(appdata, "FindWay-Agent")
    os.makedirs(dir_path, exist_ok=True)
    return dir_path


def get_projects_dir() -> str:
    dir_path = os.path.join(get_app_data_dir(), "projects")
    os.makedirs(dir_path, exist_ok=True)
    return dir_path


def get_projects_index_path() -> str:
    return os.path.join(get_projects_dir(), "index.json")


def get_user_preferences_path() -> str:
    return os.path.join(get_app_data_dir(), "user_preferences.json")


DEFAULT_PROJECT_ROOT = r"E:\MingRui\__项目文件"


def load_user_preferences() -> dict:
    path = get_user_preferences_path()
    try:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception:
        pass
    return {"default_project_path": DEFAULT_PROJECT_ROOT}


def save_user_preferences(prefs: dict):
    path = get_user_preferences_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(prefs, f, ensure_ascii=False, indent=2)
