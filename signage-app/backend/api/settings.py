"""
设置管理API模块
提供配置的读写、热重载功能
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
import json
import os
import copy

from backend.i18n import _
from backend.services.app_data import (
    get_default_project_path,
    load_user_preferences,
    save_user_preferences,
)

router = APIRouter()

# 配置文件路径
CONFIG_PATH = os.path.join(os.path.dirname(__file__), "..", "config.json")

# 默认配置结构（用于校验和合并）
DEFAULT_CONFIG = {
    "modules": {
        "project_matching": True,
        "list_compare": True,
        "cad_assist": True,
        "spec_query": False,
        "master_library": True
    },
    "workflow": {
        "new_project_steps": [
            "collect_info",
            "match_old_project",
            "generate_list_v1",
            "replace_frame",
            "remind_list_v2"
        ]
    },
    "matching_rules": {
        "type_weight": 0.5,
        "structure_weight": 0.3,
        "time_weight": 0.2,
        "max_results": 5
    },
    "list_template": {
        "columns": ["编号", "名称", "参考尺寸", "参考材质", "是否带电", "单位", "数量", "备注"]
    },
    "llm": {
        "provider": "openai_compatible",
        "api_key": "",
        "base_url": "https://api.openai.com/v1",
        "model": "gpt-4o-mini"
    },
    "safety": {
        "strictness": "standard",
        "rules_enabled": {
            "danger_patterns": True,
            "restricted_dirs": True,
            "write_operations": True,
            "llm_review": True,
        },
    },
}

class ModuleConfig(BaseModel):
    """模块开关配置"""
    project_matching: Optional[bool] = None
    list_compare: Optional[bool] = None
    cad_assist: Optional[bool] = None
    spec_query: Optional[bool] = None
    master_library: Optional[bool] = None

class MatchingRules(BaseModel):
    """匹配规则配置"""
    type_weight: Optional[float] = None
    structure_weight: Optional[float] = None
    time_weight: Optional[float] = None
    max_results: Optional[int] = None

class ListTemplate(BaseModel):
    """清单模板配置"""
    columns: Optional[List[str]] = None

class LLMConfig(BaseModel):
    """LLM配置"""
    provider: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    model: Optional[str] = None

class SettingsUpdate(BaseModel):
    """设置更新请求模型"""
    modules: Optional[ModuleConfig] = None
    matching_rules: Optional[MatchingRules] = None
    list_template: Optional[ListTemplate] = None
    llm: Optional[LLMConfig] = None


class DefaultProjectPathUpdate(BaseModel):
    """默认项目根目录"""
    default_project_path: str

def load_config() -> dict:
    """加载配置文件"""
    try:
        if os.path.exists(CONFIG_PATH):
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                config = json.load(f)
                # 合并默认配置（确保结构完整）
                merged = copy.deepcopy(DEFAULT_CONFIG)
                _deep_merge(merged, config)
                return merged
    except Exception as e:
        print(_("config_load_failed", error=e))
    return copy.deepcopy(DEFAULT_CONFIG)

def save_config(config: dict):
    """保存配置文件"""
    os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)

def _deep_merge(base: dict, override: dict):
    """深度合并字典，override中的值覆盖base"""
    for key, value in override.items():
        if key in base and isinstance(base[key], dict) and isinstance(value, dict):
            _deep_merge(base[key], value)
        else:
            base[key] = value

@router.get("/api/settings/default-project-path")
async def get_default_project_path_setting():
    """获取默认项目根目录（独立路由，避免与 /api/projects/{project_id} 冲突）"""
    path = get_default_project_path()
    print(f"[settings] GET default-project-path -> {path}")
    return {"default_project_path": path}


@router.put("/api/settings/default-project-path")
async def update_default_project_path_setting(update: DefaultProjectPathUpdate):
    """保存默认项目根目录"""
    path = update.default_project_path.strip()
    if not path:
        raise HTTPException(status_code=400, detail="项目路径不能为空")
    prefs = load_user_preferences()
    prefs["default_project_path"] = os.path.normpath(path)
    save_user_preferences(prefs)
    saved = prefs["default_project_path"]
    print(f"[settings] PUT default-project-path -> {saved}")
    return {"default_project_path": saved}


@router.get("/api/settings")
async def get_settings():
    """获取完整配置"""
    config = load_config()
    return config

@router.put("/api/settings")
async def update_settings(update: SettingsUpdate):
    """更新配置（部分更新，只修改传入的字段）"""
    config = load_config()
    
    # 更新模块开关
    if update.modules:
        for key, value in update.modules.dict(exclude_unset=True).items():
            if value is not None:
                config["modules"][key] = value
    
    # 更新匹配规则
    if update.matching_rules:
        rules = update.matching_rules.dict(exclude_unset=True)
        # 校验权重之和不超过1
        weights = []
        if "type_weight" in rules:
            weights.append(("type_weight", rules["type_weight"]))
        if "structure_weight" in rules:
            weights.append(("structure_weight", rules["structure_weight"]))
        if "time_weight" in rules:
            weights.append(("time_weight", rules["time_weight"]))
        
        # 计算当前未修改的权重
        current_weights = config["matching_rules"].copy()
        for key, val in weights:
            current_weights[key] = val
        
        total = sum(current_weights[k] for k in ["type_weight", "structure_weight", "time_weight"])
        if abs(total - 1.0) > 0.01:
            raise HTTPException(
                status_code=400, 
                detail=f"权重之和必须为1.0，当前为{total:.2f}"
            )
        
        for key, value in rules.items():
            config["matching_rules"][key] = value
    
    # 更新清单模板
    if update.list_template:
        if update.list_template.columns is not None:
            config["list_template"]["columns"] = update.list_template.columns
    
    # 更新LLM配置
    if update.llm:
        for key, value in update.llm.dict(exclude_unset=True).items():
            if value is not None:
                config["llm"][key] = value
    
    save_config(config)
    return {"message": "配置已更新", "config": config}

@router.post("/api/settings/reload")
async def reload_settings():
    """热重载配置（从磁盘重新读取）"""
    config = load_config()
    return {"message": "配置已重载", "config": config}

@router.post("/api/settings/reset")
async def reset_settings():
    """重置为默认配置"""
    save_config(DEFAULT_CONFIG)
    return {"message": "配置已重置为默认值", "config": DEFAULT_CONFIG}
