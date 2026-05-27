"""
技能管理器：加载、启用/禁用、生成 LLM 工具提示词
"""
import importlib.util
import json
import os
from typing import Any, Dict, List, Optional

from backend.skills.base import BaseSkill

_SKILLS_ROOT = os.path.dirname(os.path.abspath(__file__))
_INSTALLED_DIR = os.path.join(_SKILLS_ROOT, "installed")
_ENABLED_PATH = os.path.join(_SKILLS_ROOT, "enabled.json")

# 不在设置页展示开关的系统技能
_INTERNAL_SKILLS = {"summarize_memory"}


class SkillManager:
    def __init__(self) -> None:
        self._skills: Dict[str, Dict[str, Any]] = {}
        self.load_all()

    def _read_enabled_names(self) -> List[str]:
        if not os.path.exists(_ENABLED_PATH):
            return []
        try:
            with open(_ENABLED_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            return list(data.get("enabled") or [])
        except (json.JSONDecodeError, OSError):
            return []

    def _write_enabled_names(self, names: List[str]) -> None:
        with open(_ENABLED_PATH, "w", encoding="utf-8") as f:
            json.dump({"enabled": names}, f, ensure_ascii=False, indent=2)

    def _load_skill_instance(self, skill_dir: str, meta: dict) -> Optional[BaseSkill]:
        entry = meta.get("entry") or "main.py"
        module_path = os.path.join(skill_dir, entry)
        if not os.path.isfile(module_path):
            return None
        module_name = f"skill_{meta['name']}_{id(skill_dir)}"
        spec = importlib.util.spec_from_file_location(module_name, module_path)
        if spec is None or spec.loader is None:
            return None
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        instance = getattr(module, "skill", None)
        if isinstance(instance, BaseSkill):
            instance.name = meta.get("name") or instance.name
            instance.description = meta.get("description") or instance.description
            instance.parameters = meta.get("parameters") or instance.parameters
            return instance
        return None

    def load_all(self) -> None:
        """扫描 installed/ 加载所有技能元数据与实例"""
        self._skills = {}
        if not os.path.isdir(_INSTALLED_DIR):
            return
        for entry in sorted(os.listdir(_INSTALLED_DIR)):
            skill_dir = os.path.join(_INSTALLED_DIR, entry)
            if not os.path.isdir(skill_dir):
                continue
            meta_path = os.path.join(skill_dir, "skill.json")
            if not os.path.isfile(meta_path):
                continue
            try:
                with open(meta_path, "r", encoding="utf-8") as f:
                    meta = json.load(f)
            except (json.JSONDecodeError, OSError):
                continue
            name = meta.get("name") or entry
            instance = self._load_skill_instance(skill_dir, meta)
            enabled_names = self._read_enabled_names()
            is_internal = meta.get("internal") or name in _INTERNAL_SKILLS
            enabled = name in enabled_names or is_internal
            self._skills[name] = {
                "meta": meta,
                "instance": instance,
                "enabled": enabled,
                "internal": is_internal,
            }

    def has_skill(self, name: str) -> bool:
        return name in self._skills

    def list_all(self) -> List[Dict[str, Any]]:
        """列出所有已安装技能（含启用状态）"""
        result = []
        for name, info in self._skills.items():
            meta = info["meta"]
            result.append({
                "name": name,
                "version": meta.get("version", "1.0.0"),
                "description": meta.get("description", ""),
                "icon": meta.get("icon", "puzzle"),
                "category": meta.get("category", "其它"),
                "enabled": info["enabled"],
                "internal": info.get("internal", False),
                "parameters": meta.get("parameters", {}),
            })
        return sorted(result, key=lambda x: (x.get("internal"), x["category"], x["name"]))

    def get_enabled(self) -> List[str]:
        """返回当前启用的技能名列表（含系统内建）"""
        return [n for n, info in self._skills.items() if info["enabled"]]

    def get_enabled_skills(self) -> List[BaseSkill]:
        instances = []
        for name in self.get_enabled():
            inst = self._skills.get(name, {}).get("instance")
            if inst is not None:
                instances.append(inst)
        return instances

    def get_openai_tools(self) -> List[Dict[str, Any]]:
        """生成 OpenAI Function Calling 的 tools 列表（不含系统内建技能）"""
        tools: List[Dict[str, Any]] = []
        for name, info in self._skills.items():
            if not info["enabled"] or info.get("internal"):
                continue
            meta = info["meta"]
            params = meta.get("parameters") or {}
            properties: Dict[str, Any] = {}
            required: List[str] = []
            for key, spec in params.items():
                if isinstance(spec, dict):
                    properties[key] = {
                        "type": spec.get("type", "string"),
                        "description": spec.get("description", ""),
                    }
                else:
                    properties[key] = {"type": "string", "description": str(spec)}
                required.append(key)
            tools.append({
                "type": "function",
                "function": {
                    "name": name,
                    "description": meta.get("description", ""),
                    "parameters": {
                        "type": "object",
                        "properties": properties,
                        "required": required,
                    },
                },
            })
        return tools

    def get_tools_prompt(self) -> str:
        """生成注入 LLM System Prompt 的工具描述"""
        lines = ["## 可用技能工具", "以下技能已启用，可在回复中建议用户调用：", ""]
        count = 0
        for name, info in self._skills.items():
            if not info["enabled"] or info.get("internal"):
                continue
            meta = info["meta"]
            params = meta.get("parameters") or {}
            param_desc = ", ".join(
                f"{k}({v.get('description', v.get('type', 'string'))})"
                for k, v in params.items()
            )
            lines.append(f"- **{name}**: {meta.get('description', '')}")
            if param_desc:
                lines.append(f"  参数: {param_desc}")
            count += 1
        if count == 0:
            return ""
        return "\n".join(lines)

    def set_enabled(self, name: str, enabled: bool) -> bool:
        if name not in self._skills:
            return False
        if self._skills[name].get("internal"):
            return False
        names = [n for n in self._read_enabled_names() if n in self._skills and not self._skills[n].get("internal")]
        if enabled and name not in names:
            names.append(name)
        elif not enabled and name in names:
            names.remove(name)
        self._write_enabled_names(names)
        self._skills[name]["enabled"] = enabled
        return True

    def toggle(self, name: str) -> Optional[bool]:
        if name not in self._skills or self._skills[name].get("internal"):
            return None
        new_state = not self._skills[name]["enabled"]
        self.set_enabled(name, new_state)
        return new_state

    def skill_is_available(self, skill_name: str) -> bool:
        info = self._skills.get(skill_name)
        if not info or not info.get("instance"):
            return False
        if info.get("internal"):
            return True
        return bool(info.get("enabled"))

    async def execute(self, skill_name: str, **parameters) -> Dict[str, Any]:
        """执行技能。skill_name 为工具名；parameters 为 LLM 传入的参数字典（可含 name/path 等）。"""
        info = self._skills.get(skill_name)
        if not info or not info.get("instance"):
            return {
                "success": False,
                "no_tool_found": True,
                "missing_tool": skill_name,
                "suggest": "可调用 discover_tools 在 GitHub 搜索 findway-skill 社区技能",
                "error": f"技能不存在或未加载: {skill_name}",
            }
        if not info["enabled"] and not info.get("internal"):
            return {
                "success": False,
                "no_tool_found": True,
                "missing_tool": skill_name,
                "suggest": "可调用 discover_tools 搜索并安装新技能",
                "error": f"技能未启用: {skill_name}",
            }
        return await info["instance"].execute(**parameters)

    def discover_from_github(self, query: str) -> Dict[str, Any]:
        from backend.services.github_skill_discovery import search_skills

        return search_skills(query)

    def install_from_github(self, repo_url: str) -> Dict[str, Any]:
        from backend.services.github_skill_discovery import install_skill_repo

        result = install_skill_repo(repo_url, _INSTALLED_DIR)
        if result.get("success"):
            skill_name = result["skill_name"]
            self.load_all()
            if not self._skills.get(skill_name, {}).get("internal"):
                self.set_enabled(skill_name, True)
        return result

    async def execute_skill(
        self, skill_name: str, parameters: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """按技能名 + 参数字典执行（与 execute(skill_name, **parameters) 等价）。"""
        return await self.execute(skill_name, **(parameters or {}))

    def get_discover_catalog(self) -> List[Dict[str, str]]:
        """技能市场发现（示例）"""
        return [
            {
                "name": "export_pdf",
                "description": "将清单导出为 PDF 汇报稿",
                "category": "导出",
                "github_search": "https://github.com/search?q=findway+export+pdf+skill",
            },
            {
                "name": "batch_rename",
                "description": "按编号规则批量重命名图框文件",
                "category": "文件管理",
                "github_search": "https://github.com/search?q=findway+batch+rename+skill",
            },
            {
                "name": "spec_checker",
                "description": "自动检查标识是否符合国标规范",
                "category": "规范",
                "github_search": "https://github.com/search?q=findway+spec+checker+skill",
            },
            {
                "name": "cad_layer_audit",
                "description": "审计 CAD 图层命名与图框完整性",
                "category": "CAD",
                "github_search": "https://github.com/search?q=findway+cad+layer+skill",
            },
            {
                "name": "client_review_pack",
                "description": "打包客户审阅材料（清单+效果图）",
                "category": "协作",
                "github_search": "https://github.com/search?q=findway+client+review+skill",
            },
        ]


skill_manager = SkillManager()
