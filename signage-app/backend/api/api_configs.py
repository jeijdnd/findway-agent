"""
多API配置CRUD模块
管理 config.json 中 llm.apis 列表
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import json
import os
import copy

from backend.services.llm_engine import llm_engine

router = APIRouter()

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "..", "config.json")


class ApiConfigCreate(BaseModel):
    """新增API配置请求"""
    id: str
    name: str
    base_url: str
    api_key: str = ""
    model: str
    enabled: bool = True


class ApiConfigUpdate(BaseModel):
    """更新API配置请求（部分字段）"""
    name: Optional[str] = None
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    model: Optional[str] = None
    enabled: Optional[bool] = None


def _load_config() -> dict:
    """加载完整配置文件"""
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def _save_config(config: dict):
    """保存配置文件"""
    os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)
    # 清除 llm_engine 配置缓存
    llm_engine._config_cache = None
    llm_engine._config_mtime = 0


def _mask_api_key(api: dict) -> dict:
    """将 api_key 字段 mask 为 ***"""
    masked = copy.deepcopy(api)
    if masked.get("api_key"):
        masked["api_key"] = "***"
    return masked


def _find_api_index(apis: list, config_id: str) -> int:
    """查找配置索引，不存在返回 -1"""
    for i, api in enumerate(apis):
        if api.get("id") == config_id:
            return i
    return -1


@router.get("/api/api-configs")
async def list_api_configs():
    """获取所有API配置列表（api_key 已 mask）"""
    config = _load_config()
    apis = config.get("llm", {}).get("apis", [])
    return {"configs": [_mask_api_key(a) for a in apis]}


@router.post("/api/api-configs")
async def create_api_config(body: ApiConfigCreate):
    """添加新的API配置"""
    config = _load_config()
    if "llm" not in config:
        config["llm"] = {"apis": [], "default_api": body.id}
    if "apis" not in config["llm"]:
        config["llm"]["apis"] = []

    apis = config["llm"]["apis"]
    if _find_api_index(apis, body.id) >= 0:
        raise HTTPException(status_code=400, detail=f"配置 ID '{body.id}' 已存在")

    new_api = body.dict()
    apis.append(new_api)

    # 如果是第一个配置，设为默认
    if not config["llm"].get("default_api"):
        config["llm"]["default_api"] = body.id

    _save_config(config)
    return {"message": "API配置已添加", "config": _mask_api_key(new_api)}


@router.put("/api/api-configs/{config_id}")
async def update_api_config(config_id: str, body: ApiConfigUpdate):
    """更新指定API配置"""
    config = _load_config()
    apis = config.get("llm", {}).get("apis", [])
    idx = _find_api_index(apis, config_id)
    if idx < 0:
        raise HTTPException(status_code=404, detail=f"配置 '{config_id}' 不存在")

    updates = body.dict(exclude_unset=True)
    # 如果 api_key 为 "***" 表示未修改，跳过
    if updates.get("api_key") == "***":
        del updates["api_key"]

    for key, value in updates.items():
        apis[idx][key] = value

    _save_config(config)
    return {"message": "API配置已更新", "config": _mask_api_key(apis[idx])}


@router.delete("/api/api-configs/{config_id}")
async def delete_api_config(config_id: str):
    """删除指定API配置"""
    config = _load_config()
    apis = config.get("llm", {}).get("apis", [])
    idx = _find_api_index(apis, config_id)
    if idx < 0:
        raise HTTPException(status_code=404, detail=f"配置 '{config_id}' 不存在")

    removed = apis.pop(idx)

    # 若删除的是默认配置，切换到第一个可用配置
    if config.get("llm", {}).get("default_api") == config_id:
        config["llm"]["default_api"] = apis[0]["id"] if apis else ""

    _save_config(config)
    return {"message": "API配置已删除", "config": _mask_api_key(removed)}


@router.post("/api/api-configs/{config_id}/test")
async def test_api_config(config_id: str):
    """发送 Hello 测试API连通性"""
    api_config = llm_engine.get_config_by_id(config_id)
    if not api_config:
        raise HTTPException(status_code=404, detail=f"配置 '{config_id}' 不存在")

    result = await llm_engine.chat(
        message="Hello",
        history=[],
        api_config_id=config_id,
        use_tools=False,
    )
    reply = result.reply

    # 判断是否成功
    if reply.startswith("错误：") or reply.startswith("LLM调用失败"):
        return {"success": False, "message": reply}

    return {"success": True, "message": "连接成功", "reply": reply[:100]}
