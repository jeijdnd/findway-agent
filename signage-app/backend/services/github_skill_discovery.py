"""
GitHub 技能发现与安装：仅搜索 topic:findway-skill 仓库
"""
import json
import os
import re
import shutil
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from typing import Any, Dict, List, Optional, Tuple

GITHUB_API = "https://api.github.com"
TOPIC = "findway-skill"
MIN_STARS = 5

DANGEROUS_KEYWORDS = [
    "eval(",
    "exec(",
    "os.system",
    "subprocess",
    "__import__",
    "pickle.loads",
    "shell=true",
    "rm -rf",
    "formatdisk",
]

ALLOWED_INSTALL_FILES = {
    "skill.json",
    "main.py",
    "requirements.txt",
    "README.md",
    "LICENSE",
}


def _github_request(url: str) -> Dict[str, Any]:
    req = urllib.request.Request(
        url,
        headers={
            "Accept": "application/vnd.github+json",
            "User-Agent": "FindWay-Agent-Skill-Discovery",
        },
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _contains_dangerous(text: str) -> bool:
    lower = (text or "").lower()
    return any(kw.lower() in lower for kw in DANGEROUS_KEYWORDS)


def _score_repo(item: Dict[str, Any]) -> Tuple[int, List[str]]:
    """返回 (safety_score 0-100, warnings)"""
    warnings: List[str] = []
    score = 0
    stars = item.get("stargazers_count") or 0
    if stars >= MIN_STARS:
        score += 35
    else:
        warnings.append(f"星数较少（{stars} < {MIN_STARS}）")

    if item.get("description"):
        score += 15
    else:
        warnings.append("缺少仓库描述")

    topics = item.get("topics") or []
    if TOPIC in topics:
        score += 25
    else:
        warnings.append(f"未标记 topic:{TOPIC}")

    name = item.get("name") or ""
    desc = item.get("description") or ""
    if _contains_dangerous(name) or _contains_dangerous(desc):
        score -= 40
        warnings.append("名称或描述含可疑关键词")
    else:
        score += 25

    score = max(0, min(100, score))
    return score, warnings


def search_skills(query: str) -> Dict[str, Any]:
    """搜索 GitHub 上 findway-skill 技能仓库"""
    q = urllib.parse.quote(f"topic:{TOPIC} {query.strip()}")
    url = f"{GITHUB_API}/search/repositories?q={q}&sort=stars&order=desc&per_page=10"
    try:
        data = _github_request(url)
    except urllib.error.HTTPError as e:
        return {
            "found": False,
            "repos": [],
            "query": query,
            "error": f"GitHub API 错误: {e.code}",
        }
    except Exception as e:
        return {
            "found": False,
            "repos": [],
            "query": query,
            "error": str(e),
        }

    repos: List[Dict[str, Any]] = []
    for item in data.get("items") or []:
        safety_score, warnings = _score_repo(item)
        full_name = item.get("full_name") or ""
        repos.append({
            "name": item.get("name") or "",
            "full_name": full_name,
            "description": item.get("description") or "",
            "stars": item.get("stargazers_count") or 0,
            "safety_score": safety_score,
            "warnings": warnings,
            "install_url": item.get("html_url") or f"https://github.com/{full_name}",
            "low_safety": safety_score < 50,
        })

    return {
        "found": len(repos) > 0,
        "repos": repos,
        "query": query,
        "total_count": data.get("total_count", 0),
    }


def _parse_repo_url(repo_url: str) -> Tuple[str, str]:
    url = repo_url.strip().rstrip("/")
    m = re.match(r"https?://github\.com/([^/]+)/([^/]+?)(?:\.git)?$", url, re.I)
    if not m:
        raise ValueError("无效的 GitHub 仓库地址")
    owner, repo = m.group(1), m.group(2)
    if repo.endswith(".git"):
        repo = repo[:-4]
    return owner, repo


def _download_repo_zip(owner: str, repo: str, dest_dir: str) -> None:
    for branch in ("main", "master"):
        zip_url = f"https://github.com/{owner}/{repo}/archive/refs/heads/{branch}.zip"
        try:
            req = urllib.request.Request(
                zip_url,
                headers={"User-Agent": "FindWay-Agent-Skill-Discovery"},
            )
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = resp.read()
            zip_path = os.path.join(dest_dir, "repo.zip")
            with open(zip_path, "wb") as f:
                f.write(data)
            with zipfile.ZipFile(zip_path, "r") as zf:
                zf.extractall(dest_dir)
            os.remove(zip_path)
            return
        except urllib.error.HTTPError:
            continue
    raise ValueError(f"无法下载仓库 {owner}/{repo}（main/master 分支均失败）")


def _validate_skill_dir(skill_dir: str) -> Dict[str, Any]:
    meta_path = os.path.join(skill_dir, "skill.json")
    if not os.path.isfile(meta_path):
        raise ValueError("缺少 skill.json")

    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)

    skill_name = (meta.get("name") or "").strip()
    if not skill_name or not re.match(r"^[a-z][a-z0-9_]*$", skill_name):
        raise ValueError("skill.json 中 name 无效")

    entry = meta.get("entry") or "main.py"
    entry_path = os.path.join(skill_dir, entry)
    if not os.path.isfile(entry_path):
        raise ValueError(f"入口文件不存在: {entry}")

    for root, _dirs, files in os.walk(skill_dir):
        for fname in files:
            if fname in ALLOWED_INSTALL_FILES or fname.endswith(".py"):
                fpath = os.path.join(root, fname)
                try:
                    with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read(8000)
                    if _contains_dangerous(content):
                        raise ValueError(f"文件含可疑代码模式: {fname}")
                except ValueError:
                    raise
                except OSError:
                    pass

    return meta


def install_skill_repo(repo_url: str, installed_dir: str) -> Dict[str, Any]:
    """克隆/下载技能到 installed/ 并验签"""
    owner, repo = _parse_repo_url(repo_url)
    skill_name = repo.replace("-", "_").lower()

    target_dir = os.path.join(installed_dir, skill_name)
    if os.path.isdir(target_dir):
        return {
            "success": False,
            "error": f"技能目录已存在: {skill_name}，请先删除或更换仓库",
        }

    with tempfile.TemporaryDirectory() as tmp:
        _download_repo_zip(owner, repo, tmp)
        extracted = None
        for entry in os.listdir(tmp):
            if entry.endswith("-main") or entry.endswith("-master") or entry.startswith(repo):
                extracted = os.path.join(tmp, entry)
                break
        if not extracted or not os.path.isdir(extracted):
            subs = [
                os.path.join(tmp, d)
                for d in os.listdir(tmp)
                if os.path.isdir(os.path.join(tmp, d))
            ]
            extracted = subs[0] if subs else None
        if not extracted:
            return {"success": False, "error": "解压后未找到技能目录"}

        meta = _validate_skill_dir(extracted)
        skill_name = meta.get("name") or skill_name
        target_dir = os.path.join(installed_dir, skill_name)

        if os.path.isdir(target_dir):
            return {"success": False, "error": f"技能 {skill_name} 已安装"}

        shutil.copytree(extracted, target_dir)

    return {
        "success": True,
        "skill_name": skill_name,
        "message": f"技能「{skill_name}」已安装并启用",
    }
