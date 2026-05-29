"""
Agent B：工具调用安全审核（规则 + 可选 LLM 复核）
"""
import json
import os
import re
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from backend.services.safety_log_service import append_safety_log

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "..", "config.json")

DEFAULT_SAFETY = {
    "strictness": "standard",
    "rules_enabled": {
        "danger_patterns": True,
        "restricted_dirs": True,
        "write_operations": True,
        "llm_review": True,
    },
}

# 待用户放行的拦截记录 audit_id -> {skill_name, parameters}
_pending_bypass: Dict[str, Dict[str, Any]] = {}


@dataclass
class AuditResult:
    allowed: bool
    reason: str = ""
    risk_level: str = "low"
    audit_id: str = ""
    auditor: str = "rules"
    skill_name: str = ""
    parameters: Dict[str, Any] = field(default_factory=dict)


class SafetyAuditor:
    DANGER_PATTERNS = [
        (r"rm\s+-rf", "检测到删除系统文件类命令"),
        (r"format\s+\w:", "检测到磁盘格式化命令"),
        (r"del\s+/[fFsS]\s+/[qQ]", "检测到强制删除命令"),
        (r"\bshutdown\b", "检测到关机命令"),
        (r"reg\s+(add|delete)", "检测到注册表修改"),
        (r">>\s*C:\\\\Windows", "检测到写入系统目录"),
        (r"powershell\s+.*-enc(odedcommand)?", "检测到编码 PowerShell 执行"),
        (r"invoke-expression|iex\s", "检测到动态代码执行"),
    ]

    RESTRICTED_DIRS = [
        "C:\\Windows",
        "C:\\Windows\\System32",
        "C:\\Program Files",
        "C:\\Program Files (x86)",
    ]

    WRITE_SKILLS = frozenset({
        "create_project",
        "manage_projects",
    })

    HIGH_RISK_PATH_KEYWORDS = ["register", "install-from-github"]

    def __init__(self) -> None:
        self._load_config()

    def _load_config(self) -> Dict[str, Any]:
        try:
            if os.path.exists(CONFIG_PATH):
                with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                    cfg = json.load(f)
                safety = cfg.get("safety") or {}
                merged = dict(DEFAULT_SAFETY)
                merged["strictness"] = safety.get("strictness", merged["strictness"])
                rules = dict(DEFAULT_SAFETY["rules_enabled"])
                rules.update(safety.get("rules_enabled") or {})
                merged["rules_enabled"] = rules
                self._config = merged
                return merged
        except (json.JSONDecodeError, OSError):
            pass
        self._config = dict(DEFAULT_SAFETY)
        return self._config

    def reload_config(self) -> Dict[str, Any]:
        return self._load_config()

    def get_config(self) -> Dict[str, Any]:
        return dict(self._config)

    def _normalize_path(self, path: str) -> str:
        p = (path or "").strip()
        p = os.path.expandvars(p)
        return os.path.normpath(p).upper()

    def _path_in_restricted(self, path: str) -> Optional[str]:
        norm = self._normalize_path(path)
        if not norm:
            return None
        for restricted in self.RESTRICTED_DIRS:
            r = self._normalize_path(restricted)
            if norm == r or norm.startswith(r + os.sep):
                return restricted
        return None

    def _scan_text_for_danger(self, text: str) -> Optional[str]:
        if not text:
            return None
        for pattern, msg in self.DANGER_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE):
                return msg
        return None

    def _collect_param_text(self, parameters: dict) -> str:
        parts = []
        for v in parameters.values():
            if isinstance(v, str):
                parts.append(v)
            elif isinstance(v, (list, dict)):
                parts.append(json.dumps(v, ensure_ascii=False))
            else:
                parts.append(str(v))
        return " ".join(parts)

    def _is_write_operation(self, skill_name: str, parameters: dict) -> bool:
        if skill_name in self.WRITE_SKILLS:
            return True
        op = str(parameters.get("operation") or "").lower()
        if op == "write":
            return True
        if skill_name == "scan_directory" and parameters.get("register"):
            return True
        return False

    def _strictness_blocks_write_outside_projects(
        self, skill_name: str, parameters: dict
    ) -> Optional[str]:
        strictness = self._config.get("strictness", "standard")
        if strictness == "relaxed":
            return None
        path_keys = ["path", "root_path", "dir_path", "file_path", "repo_url"]
        for key in path_keys:
            val = parameters.get(key)
            if not isinstance(val, str) or not val.strip():
                continue
            restricted = self._path_in_restricted(val)
            if restricted:
                return f"路径位于受限制系统目录: {restricted}"
        return None

    async def _llm_review(
        self, skill_name: str, parameters: dict, api_config_id: Optional[str] = None
    ) -> AuditResult:
        from backend.services.llm_engine import llm_engine

        prompt = f"""你是安全审核 Agent B。判断以下工具调用是否可安全执行。
只回答 JSON：{{"allowed": true/false, "reason": "简短中文原因", "risk_level": "low|medium|high"}}

技能: {skill_name}
参数: {json.dumps(parameters, ensure_ascii=False)}

原则：只读扫描项目目录通常允许；写入/注册/安装需明确用户意图；系统目录与破坏性命令必须拒绝。"""
        try:
            result = await llm_engine.chat(
                message=prompt,
                history=[],
                api_config_id=api_config_id,
                use_tools=False,
            )
            text = (result.reply or "").strip()
            m = re.search(r"\{[\s\S]*\}", text)
            if m:
                data = json.loads(m.group())
                return AuditResult(
                    allowed=bool(data.get("allowed")),
                    reason=data.get("reason") or "LLM 审核结果",
                    risk_level=data.get("risk_level") or "medium",
                    auditor="llm",
                    skill_name=skill_name,
                    parameters=parameters,
                )
        except Exception as e:
            return AuditResult(
                allowed=False,
                reason=f"LLM 安全审核失败，保守拦截: {e}",
                risk_level="high",
                auditor="llm",
                skill_name=skill_name,
                parameters=parameters,
            )
        return AuditResult(
            allowed=False,
            reason="无法解析 LLM 审核结果，已保守拦截",
            risk_level="medium",
            auditor="llm",
            skill_name=skill_name,
            parameters=parameters,
        )

    async def audit(
        self,
        skill_name: str,
        parameters: Optional[Dict[str, Any]] = None,
        *,
        user_bypass: bool = False,
        api_config_id: Optional[str] = None,
    ) -> AuditResult:
        self._load_config()
        params = dict(parameters or {})
        rules = self._config.get("rules_enabled") or {}
        strictness = self._config.get("strictness", "standard")

        if user_bypass:
            append_safety_log(
                skill_name, params, True, "用户请求放行", "medium", "user", True
            )
            return AuditResult(
                allowed=True,
                reason="用户已确认放行",
                risk_level="medium",
                auditor="user",
                skill_name=skill_name,
                parameters=params,
            )

        param_text = self._collect_param_text(params)
        reasons: List[str] = []
        risk = "low"

        if rules.get("danger_patterns", True):
            hit = self._scan_text_for_danger(param_text)
            if hit:
                reasons.append(hit)
                risk = "high"

        if rules.get("restricted_dirs", True):
            for key in ("path", "root_path", "dir_path", "file_path"):
                val = params.get(key)
                if isinstance(val, str):
                    restricted = self._path_in_restricted(val)
                    if restricted:
                        reasons.append(f"目标路径在受限制目录: {restricted}")
                        risk = "high"

        if rules.get("write_operations", True) and self._is_write_operation(
            skill_name, params
        ):
            block = self._strictness_blocks_write_outside_projects(skill_name, params)
            if block:
                reasons.append(block)
                risk = "high"
            elif strictness == "strict":
                reasons.append("严格模式：写入类操作需人工确认")
                risk = "medium"

        if strictness == "strict" and skill_name == "discover_tools":
            if "install" in param_text.lower():
                reasons.append("严格模式：安装外部技能需人工确认")
                risk = "medium"

        needs_llm = (
            rules.get("llm_review", True)
            and strictness == "strict"
            and self._is_write_operation(skill_name, params)
            and not reasons
        )

        if reasons:
            audit_id = str(uuid.uuid4())
            reason = "；".join(reasons)
            _pending_bypass[audit_id] = {
                "skill_name": skill_name,
                "parameters": params,
            }
            append_safety_log(skill_name, params, False, reason, risk, "rules")
            return AuditResult(
                allowed=False,
                reason=reason,
                risk_level=risk,
                audit_id=audit_id,
                auditor="rules",
                skill_name=skill_name,
                parameters=params,
            )

        if needs_llm and not reasons:
            llm_result = await self._llm_review(skill_name, params, api_config_id)
            if not llm_result.allowed:
                audit_id = str(uuid.uuid4())
                _pending_bypass[audit_id] = {
                    "skill_name": skill_name,
                    "parameters": params,
                }
                append_safety_log(
                    skill_name,
                    params,
                    False,
                    llm_result.reason,
                    llm_result.risk_level,
                    "llm",
                )
                llm_result.audit_id = audit_id
                return llm_result
            append_safety_log(
                skill_name, params, True, llm_result.reason or "LLM 放行", "low", "llm"
            )
            return llm_result

        append_safety_log(skill_name, params, True, "", "low", "rules")
        return AuditResult(
            allowed=True,
            skill_name=skill_name,
            parameters=params,
        )

    def get_pending(self, audit_id: str) -> Optional[Dict[str, Any]]:
        return _pending_bypass.get(audit_id)

    def consume_bypass(self, audit_id: str) -> Optional[Dict[str, Any]]:
        return _pending_bypass.pop(audit_id, None)


safety_auditor = SafetyAuditor()
