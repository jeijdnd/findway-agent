"""
用户数据目录 %APPDATA%/FindWay-Agent/
"""
import os


def get_app_data_dir() -> str:
    appdata = os.environ.get("APPDATA")
    if not appdata:
        appdata = os.environ.get("XDG_CONFIG_HOME") or os.path.expanduser("~")
    dir_path = os.path.join(appdata, "FindWay-Agent")
    os.makedirs(dir_path, exist_ok=True)
    return dir_path
