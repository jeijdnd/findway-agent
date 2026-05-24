"""
LLM对话引擎核心模块
封装OpenAI兼容API，支持多API配置、流式输出、意图识别
"""

import json
import os
import re
from typing import AsyncGenerator, List, Dict, Any, Optional
from openai import AsyncOpenAI

# 系统提示词预设
SYSTEM_PROMPT = """你是标识设计AI助手，专注于建筑导视标识设计领域。你的主要职责包括：

1. **项目管理**：帮助用户创建、管理标识设计项目
2. **旧项目匹配**：根据用户需求搜索和推荐相似的旧项目
3. **清单对比**：帮助用户对比不同版本的清单差异
4. **兔钉导出合并**：协助用户合并和整理兔钉导出数据
5. **规范查询**：提供标识设计相关的规范和标准咨询

你需要：
- 理解用户的意图，并给出相应的操作建议
- 对于需要用户确认的操作，提供清晰的选项
- 对于数据查询，返回结构化的结果
- 保持专业、友好的交流风格

注意：不要在回复中暴露API密钥或其他敏感信息。"""


class LLMEngine:
    """LLM对话引擎核心类"""
    
    def __init__(self):
        """初始化LLM引擎"""
        self.config_path = os.path.join(os.path.dirname(__file__), "..", "config.json")
        self._config_cache = None
        self._config_mtime = 0
    
    def _load_config(self) -> Dict[str, Any]:
        """加载配置文件，支持缓存"""
        try:
            # 检查文件修改时间
            mtime = os.path.getmtime(self.config_path)
            if mtime != self._config_mtime or self._config_cache is None:
                with open(self.config_path, "r", encoding="utf-8") as f:
                    self._config_cache = json.load(f)
                self._config_mtime = mtime
            return self._config_cache
        except Exception as e:
            print(f"加载配置文件失败: {e}")
            return {}
    
    def get_active_configs(self) -> List[Dict[str, Any]]:
        """获取所有已启用的API配置"""
        config = self._load_config()
        llm_config = config.get("llm", {})
        apis = llm_config.get("apis", [])
        return [api for api in apis if api.get("enabled", False)]
    
    def get_config_by_id(self, config_id: str) -> Optional[Dict[str, Any]]:
        """根据ID获取API配置"""
        config = self._load_config()
        llm_config = config.get("llm", {})
        apis = llm_config.get("apis", [])
        for api in apis:
            if api.get("id") == config_id:
                return api
        return None
    
    def get_default_config(self) -> Optional[Dict[str, Any]]:
        """获取默认API配置"""
        config = self._load_config()
        llm_config = config.get("llm", {})
        default_id = llm_config.get("default_api")
        if default_id:
            return self.get_config_by_id(default_id)
        # 如果没有默认配置，返回第一个启用的配置
        active_configs = self.get_active_configs()
        return active_configs[0] if active_configs else None
    
    def _sanitize_error(self, error: Exception) -> str:
        """将异常转为友好错误消息，不暴露 api_key"""
        msg = str(error)
        # 移除可能出现在错误信息中的密钥片段
        msg = re.sub(r"sk-[A-Za-z0-9\-_]{10,}", "***", msg)
        msg = re.sub(r"api[_-]?key[=:\s]+[^\s,;]+", "api_key=***", msg, flags=re.IGNORECASE)
        if "401" in msg or "Unauthorized" in msg or "authentication" in msg.lower():
            return "LLM调用失败：API密钥无效或未配置，请在设置中检查API配置"
        if "404" in msg or "model" in msg.lower() and "not found" in msg.lower():
            return "LLM调用失败：模型不存在或不可用，请检查模型名称"
        if "timeout" in msg.lower() or "timed out" in msg.lower():
            return "LLM调用失败：请求超时，请稍后重试"
        if "connection" in msg.lower():
            return "LLM调用失败：无法连接到API服务，请检查网络或 base_url 配置"
        return f"LLM调用失败：{msg}"

    def _create_client(self, api_config: Dict[str, Any]) -> AsyncOpenAI:
        """创建OpenAI客户端"""
        api_key = api_config.get("api_key", "")
        base_url = api_config.get("base_url", "https://api.openai.com/v1")
        
        # 如果api_key为空，尝试从环境变量读取
        if not api_key:
            api_key = os.getenv("LLM_API_KEY", "")
        
        return AsyncOpenAI(
            api_key=api_key,
            base_url=base_url
        )
    
    def _format_history(self, history: List[Dict[str, str]]) -> List[Dict[str, str]]:
        """格式化对话历史，确保符合OpenAI格式"""
        formatted_history = []
        for msg in history:
            formatted_msg = {
                "role": msg.get("role", "user"),
                "content": msg.get("content", "")
            }
            formatted_history.append(formatted_msg)
        return formatted_history
    
    async def chat_stream(
        self, 
        message: str, 
        history: List[Dict[str, str]], 
        api_config_id: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        """
        流式对话接口，逐token yield
        
        Args:
            message: 用户消息
            history: 对话历史
            api_config_id: API配置ID，为None时使用默认配置
            
        Yields:
            每个token的内容
        """
        # 获取API配置
        if api_config_id:
            api_config = self.get_config_by_id(api_config_id)
        else:
            api_config = self.get_default_config()
        
        if not api_config:
            yield "错误：没有可用的API配置，请在设置中添加并启用LLM API"
            return

        api_key = api_config.get("api_key", "") or os.getenv("LLM_API_KEY", "")
        if not api_key:
            yield "错误：API密钥未配置，请在设置中填写 api_key 或设置环境变量 LLM_API_KEY"
            return

        try:
            client = self._create_client(api_config)
            model = api_config.get("model", "gpt-4o-mini")
            
            # 格式化对话历史
            formatted_history = self._format_history(history)
            
            # 构建消息列表
            messages = [{"role": "system", "content": SYSTEM_PROMPT}]
            messages.extend(formatted_history)
            messages.append({"role": "user", "content": message})
            
            # 调用流式API
            stream = await client.chat.completions.create(
                model=model,
                messages=messages,
                stream=True,
                temperature=0.7,
                max_tokens=2048
            )
            
            # 逐token yield
            async for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
                    
        except Exception as e:
            yield self._sanitize_error(e)

    async def chat(
        self, 
        message: str, 
        history: List[Dict[str, str]], 
        api_config_id: Optional[str] = None
    ) -> str:
        """
        非流式对话接口，返回完整回复
        
        Args:
            message: 用户消息
            history: 对话历史
            api_config_id: API配置ID，为None时使用默认配置
            
        Returns:
            完整的回复内容
        """
        # 获取API配置
        if api_config_id:
            api_config = self.get_config_by_id(api_config_id)
        else:
            api_config = self.get_default_config()
        
        if not api_config:
            return "错误：没有可用的API配置，请在设置中添加并启用LLM API"

        api_key = api_config.get("api_key", "") or os.getenv("LLM_API_KEY", "")
        if not api_key:
            return "错误：API密钥未配置，请在设置中填写 api_key 或设置环境变量 LLM_API_KEY"

        try:
            client = self._create_client(api_config)
            model = api_config.get("model", "gpt-4o-mini")

            # 格式化对话历史
            formatted_history = self._format_history(history)

            # 构建消息列表
            messages = [{"role": "system", "content": SYSTEM_PROMPT}]
            messages.extend(formatted_history)
            messages.append({"role": "user", "content": message})

            # 调用非流式API
            response = await client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.7,
                max_tokens=2048
            )

            return response.choices[0].message.content or ""

        except Exception as e:
            return self._sanitize_error(e)
    
    async def infer_intent(
        self, 
        message: str, 
        history: List[Dict[str, str]]
    ) -> str:
        """
        推断用户意图
        
        Args:
            message: 用户消息
            history: 对话历史
            
        Returns:
            意图字符串：create_project/search_old_project/compare_list/query_spec/merge_tuding/general
        """
        # 构建意图识别的提示词
        intent_prompt = f"""请分析用户消息的意图，返回以下其中一个意图代码：

- create_project: 用户想要创建新项目
- search_old_project: 用户想要搜索或匹配旧项目
- compare_list: 用户想要对比清单
- query_spec: 用户想要查询规范或标准
- merge_tuding: 用户想要合并兔钉导出数据
- general: 其他通用对话

用户消息：{message}

只返回意图代码，不要返回其他内容。"""
        
        try:
            # 使用简化的配置进行意图识别
            api_config = self.get_default_config()
            if not api_config:
                # 如果没有API配置，使用简单的关键词匹配作为降级方案
                return self._fallback_intent_recognition(message)
            
            client = self._create_client(api_config)
            model = api_config.get("model", "gpt-4o-mini")
            
            response = await client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": "你是意图识别助手，只返回意图代码。"},
                    {"role": "user", "content": intent_prompt}
                ],
                temperature=0.1,
                max_tokens=50
            )
            
            intent = response.choices[0].message.content.strip().lower()
            
            # 验证意图代码
            valid_intents = ["create_project", "search_old_project", "compare_list", 
                           "query_spec", "merge_tuding", "general"]
            if intent in valid_intents:
                return intent
            else:
                return "general"
                
        except Exception as e:
            # 出错时使用降级方案
            return self._fallback_intent_recognition(message)
    
    def _fallback_intent_recognition(self, message: str) -> str:
        """
        降级意图识别（关键词匹配）
        
        Args:
            message: 用户消息
            
        Returns:
            意图字符串
        """
        message_lower = message.lower()
        
        # 创建项目意图
        create_keywords = ["创建项目", "新建项目", "建立项目", "创建一个", "新建一个", "建一个"]
        if any(kw in message_lower for kw in create_keywords):
            return "create_project"
        
        # 搜索旧项目意图
        search_keywords = ["搜索旧项目", "查找旧项目", "找旧项目", "匹配旧项目", "找类似的", "推荐旧项目"]
        if any(kw in message_lower for kw in search_keywords):
            return "search_old_project"
        
        # 对比清单意图
        compare_keywords = ["对比清单", "比较清单", "清单对比", "对比两版", "比较两版", "差异对比"]
        if any(kw in message_lower for kw in compare_keywords):
            return "compare_list"
        
        # 查询规范意图
        spec_keywords = ["规范", "标准", "规定", "要求", "安装高度", "设计规范"]
        if any(kw in message_lower for kw in spec_keywords):
            return "query_spec"
        
        # 合并兔钉导出意图
        merge_keywords = ["合并兔钉", "兔钉合并", "兔钉导出", "导出合并"]
        if any(kw in message_lower for kw in merge_keywords):
            return "merge_tuding"
        
        return "general"


# 创建全局LLM引擎实例
llm_engine = LLMEngine()