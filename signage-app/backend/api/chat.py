"""
聊天API模块
提供对话接口，当前使用关键词意图识别
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import json
import os
from datetime import datetime

router = APIRouter()

class ChatMessage(BaseModel):
    """聊天消息数据模型"""
    role: str
    content: str
    timestamp: str

class ChatRequest(BaseModel):
    """聊天请求数据模型"""
    message: str
    project_id: Optional[str] = None

class ChatResponse(BaseModel):
    """聊天响应数据模型"""
    reply: str
    action: Optional[str] = None
    data: Optional[dict] = None

CHAT_HISTORY_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "chat_history.json")

def load_chat_history(project_id: str = None) -> List[ChatMessage]:
    """加载聊天历史"""
    try:
        if os.path.exists(CHAT_HISTORY_PATH):
            with open(CHAT_HISTORY_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                key = project_id or "default"
                return [ChatMessage(**msg) for msg in data.get(key, [])]
    except Exception:
        pass
    return []

def save_chat_history(messages: List[ChatMessage], project_id: str = None):
    """保存聊天历史"""
    try:
        data = {}
        if os.path.exists(CHAT_HISTORY_PATH):
            with open(CHAT_HISTORY_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
        key = project_id or "default"
        data[key] = [msg.dict() for msg in messages]
        os.makedirs(os.path.dirname(CHAT_HISTORY_PATH), exist_ok=True)
        with open(CHAT_HISTORY_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"保存聊天历史失败: {e}")

def intent_recognition(message: str) -> tuple:
    """关键词意图识别，返回(意图, 参数)"""
    message_lower = message.lower()
    # 创建项目意图 - 支持多种表述
    create_keywords = ["创建项目", "新建项目", "建立项目", "创建一个", "新建一个", "建一个"]
    if any(kw in message_lower for kw in create_keywords):
        # 尝试提取项目名称
        for kw in ["项目", "工程", "学校", "办公", "住宅", "，", ",", "类型"]:
            if kw in message_lower:
                parts = message.split(kw)
                if len(parts) > 1 and parts[0].strip():
                    # 清理项目名称中的前缀
                    name = parts[0].strip()
                    for prefix in ["帮我", "请", "我想", "我要", "创建一个", "新建一个", "建一个"]:
                        name = name.replace(prefix, "")
                    if name:
                        return "create_project", {"name": name}
        return "create_project", {}
    
    # 搜索旧项目意图 - 支持带类型参数
    search_keywords = ["搜索旧项目", "查找旧项目", "找旧项目", "匹配旧项目", "找类似的", "推荐旧项目"]
    if any(kw in message_lower for kw in search_keywords):
        # 尝试提取项目类型
        project_type = None
        type_keywords = ["学校", "办公", "住宅", "医院", "商业", "工业"]
        for type_kw in type_keywords:
            if type_kw in message_lower:
                project_type = type_kw
                break
        
        # 提取关键词
        keywords = None
        keyword_patterns = ["旧项目", "项目", "清单", "施工图"]
        for pattern in keyword_patterns:
            if pattern in message_lower:
                # 移除搜索关键词和类型关键词，剩下的作为关键词
                temp_message = message_lower
                for search_kw in search_keywords:
                    temp_message = temp_message.replace(search_kw, "")
                for type_kw in type_keywords:
                    temp_message = temp_message.replace(type_kw, "")
                for pattern_kw in keyword_patterns:
                    temp_message = temp_message.replace(pattern_kw, "")
                temp_message = temp_message.strip()
                if temp_message:
                    keywords = temp_message
                break
        
        return "search_old_project", {"project_type": project_type, "keywords": keywords}
    
    if any(kw in message_lower for kw in ["对比清单", "比较清单", "清单对比", "对比两版", "比较两版", "差异对比"]):
        return "compare_list", {}
    if any(kw in message_lower for kw in ["规范", "标准", "规定", "要求", "安装高度", "设计规范"]):
        return "query_spec", {}
    return "default", {}

@router.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """聊天接口，接收用户消息，返回AI回复"""
    try:
        history = load_chat_history(request.project_id)
        user_message = ChatMessage(
            role="user",
            content=request.message,
            timestamp=datetime.now().isoformat()
        )
        history.append(user_message)
        intent, params = intent_recognition(request.message)
        if intent == "create_project":
            project_name = params.get("name", "新项目")
            reply = f"好的，已创建\"{project_name}\"项目。需要我帮你找类似的旧项目来套用吗？"
            action = "create_project"
            data = {"project_name": project_name}
        elif intent == "search_old_project":
            project_type = params.get("project_type")
            keywords = params.get("keywords")
            
            # 构建回复消息
            if project_type and keywords:
                reply = f"正在为您搜索{project_type}类型的旧项目，关键词：{keywords}，请稍候..."
            elif project_type:
                reply = f"正在为您搜索{project_type}类型的旧项目，请稍候..."
            elif keywords:
                reply = f"正在为您搜索包含关键词"{keywords}"的旧项目，请稍候..."
            else:
                reply = "正在为您搜索匹配的旧项目，请稍候..."
            
            action = "search_old_project"
            data = {"project_type": project_type, "keywords": keywords}
        elif intent == "compare_list":
            reply = "好的，请上传两份清单文件进行对比。你可以在右侧面板的「清单对比」页面中拖放或点击上传Excel文件，系统会自动识别表头并按编号字段进行差异对比。"
            action = "compare_list"
            data = {}
        elif intent == "query_spec":
            reply = "规范查询功能正在开发中，敬请期待！"
            action = "query_spec"
            data = {}
        else:
            reply = "你好！我是标识Agent，建筑导视标识设计AI助手。我可以帮你：\n1. 创建新项目\n2. 搜索旧项目\n3. 对比清单\n4. 查询规范\n\n请告诉我你需要什么帮助？"
            action = None
            data = None
        assistant_message = ChatMessage(
            role="assistant",
            content=reply,
            timestamp=datetime.now().isoformat()
        )
        history.append(assistant_message)
        save_chat_history(history, request.project_id)
        return ChatResponse(reply=reply, action=action, data=data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"聊天处理失败: {str(e)}")

@router.get("/api/chat/history")
async def get_chat_history(project_id: Optional[str] = None):
    """获取聊天历史"""
    try:
        history = load_chat_history(project_id)
        return {"history": [msg.dict() for msg in history]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取聊天历史失败: {str(e)}")