"""
LLM对话引擎核心模块
封装OpenAI兼容API，支持多API配置、流式输出、意图识别
"""

import copy
import json
import os
import re
from dataclasses import dataclass, field
from typing import AsyncGenerator, List, Dict, Any, Optional, Callable, Awaitable
from openai import AsyncOpenAI

ToolExecutor = Callable[[str, Dict[str, Any]], Awaitable[Dict[str, Any]]]

MAX_TOOL_ROUNDS = 5

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

注意：不要在回复中暴露API密钥或其他敏感信息。

当用户请求扫描目录、创建项目、对比清单等操作时，请调用提供的工具函数，并根据工具返回的真实数据组织回复，不要编造未出现在工具结果中的目录或文件名。

当用户说「添加到项目仪表盘」「加入仪表盘」「注册到仪表盘」等时，必须调用 create_project 技能（传入项目名称与路径），不要回复没有相关工具。

当用户需求超出当前已启用工具能力（如 CAD 读取、PDF 导出等）时，应调用 discover_tools 技能在 GitHub 搜索 findway-skill 社区技能，不要直接说「没有工具」。"""


@dataclass
class ChatWithToolsResult:
    """Function Calling 对话结果"""

    reply: str
    actions: List[str] = field(default_factory=list)
    action_data: Dict[str, Any] = field(default_factory=dict)
    tools_called: List[str] = field(default_factory=list)


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
        """根据ID获取API配置（返回副本，避免缓存对象被意外修改）"""
        config = self._load_config()
        llm_config = config.get("llm", {})
        apis = llm_config.get("apis", [])
        for api in apis:
            if api.get("id") == config_id:
                return copy.deepcopy(api)
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
    
    def invalidate_config_cache(self):
        """清除配置缓存，强制下次从磁盘重新读取"""
        self._config_cache = None
        self._config_mtime = 0

    def _read_fresh_api_key(self, config_id: str) -> str:
        """从磁盘直接读取 api_key，避免内存缓存仍为空字符串"""
        try:
            with open(self.config_path, "r", encoding="utf-8") as f:
                config = json.load(f)
            llm_config = config.get("llm", {})
            for api in llm_config.get("apis", []):
                if api.get("id") == config_id:
                    key = (api.get("api_key") or "").strip()
                    if key and key != "***":
                        return key
            legacy_key = (llm_config.get("api_key") or "").strip()
            if legacy_key and legacy_key != "***":
                return legacy_key
        except Exception as e:
            print(f"读取 API Key 失败: {e}")
        return ""

    def _resolve_api_key(self, api_config: Dict[str, Any]) -> str:
        """优先环境变量 LLM_API_KEY，否则从磁盘/config 读取 api_key"""
        env_key = (os.getenv("LLM_API_KEY") or "").strip()
        if env_key:
            return env_key

        config_id = (api_config.get("id") or "").strip()
        if config_id:
            fresh_key = self._read_fresh_api_key(config_id)
            if fresh_key:
                return fresh_key

        key = (api_config.get("api_key") or "").strip()
        if key and key != "***":
            return key
        return ""

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
        """创建OpenAI客户端，每次调用都重新解析 api_key"""
        api_key = self._resolve_api_key(api_config)
        base_url = api_config.get("base_url", "https://api.openai.com/v1")

        return AsyncOpenAI(
            api_key=api_key or None,
            base_url=base_url
        )

    def resolve_api_config(self, api_config_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """解析本次请求使用的 API 配置，并注入已解析的 api_key"""
        if api_config_id:
            api_config = self.get_config_by_id(api_config_id)
        else:
            api_config = self.get_default_config()
            if api_config is not None:
                api_config = copy.deepcopy(api_config)

        if not api_config:
            return None

        api_config["api_key"] = self._resolve_api_key(api_config)
        return api_config
    
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

    def build_system_prompt(self, project_id: Optional[str] = None) -> str:
        """组装系统提示：基础人设 + 已启用技能 + 项目 memory.md"""
        from backend.services.project_memory import read_memory_md
        from backend.skills import skill_manager

        parts = [SYSTEM_PROMPT]
        tools_prompt = skill_manager.get_tools_prompt()
        if tools_prompt:
            parts.append(f"\n\n{tools_prompt}")
        memory = read_memory_md(project_id)
        if memory:
            parts.append(f"\n\n## 项目记忆（memory.md）\n{memory}")
        return "\n".join(parts)

    def _build_openai_tools(self) -> List[Dict[str, Any]]:
        from backend.skills import skill_manager

        return skill_manager.get_openai_tools()

    def _assistant_message_dict(self, message: Any) -> Dict[str, Any]:
        """将 assistant 消息转为 API 可继续对话的 dict（含 DeepSeek thinking 的 reasoning_content）"""
        payload: Dict[str, Any] = {"role": "assistant", "content": message.content or None}
        reasoning = getattr(message, "reasoning_content", None)
        if reasoning:
            payload["reasoning_content"] = reasoning
        if message.tool_calls:
            payload["tool_calls"] = [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments or "{}",
                    },
                }
                for tc in message.tool_calls
            ]
        return payload

    async def _chat_with_tools_loop(
        self,
        messages: List[Dict[str, Any]],
        api_config: Dict[str, Any],
        tool_executor: ToolExecutor,
    ) -> ChatWithToolsResult:
        client = self._create_client(api_config)
        model = api_config.get("model", "gpt-4o-mini")
        tools = self._build_openai_tools()
        tools_called: List[str] = []
        actions: List[str] = []
        action_data: Dict[str, Any] = {}

        create_kwargs: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": 0.7,
            "max_tokens": 2048,
        }
        if tools:
            create_kwargs["tools"] = tools
            create_kwargs["tool_choice"] = "auto"

        for _ in range(MAX_TOOL_ROUNDS):
            response = await client.chat.completions.create(**create_kwargs)
            choice = response.choices[0].message

            if not choice.tool_calls:
                return ChatWithToolsResult(
                    reply=choice.content or "",
                    actions=actions,
                    action_data=action_data,
                    tools_called=tools_called,
                )

            messages.append(self._assistant_message_dict(choice))

            for tool_call in choice.tool_calls:
                name = tool_call.function.name
                try:
                    args = json.loads(tool_call.function.arguments or "{}")
                except json.JSONDecodeError:
                    args = {}

                result = await tool_executor(name, args)
                tools_called.append(name)

                if result.get("no_tool_found"):
                    action_data["no_tool_found"] = True
                    action_data["missing_tool"] = result.get("missing_tool")
                    action_data["suggest_github_search"] = True

                if result.get("blocked"):
                    action_data["safety_blocked"] = {
                        "audit_id": result.get("audit_id"),
                        "reason": result.get("reason"),
                        "risk_level": result.get("risk_level"),
                        "skill_name": result.get("skill_name"),
                        "parameters": result.get("parameters"),
                    }

                ui_action, ui_data = self._map_tool_to_ui_action(name, result)
                if ui_action and ui_action not in actions:
                    actions.append(ui_action)
                    action_data.update(ui_data)

                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(result, ensure_ascii=False),
                })

            create_kwargs["messages"] = messages

        return ChatWithToolsResult(
            reply="抱歉，工具调用次数过多，请简化请求后重试。",
            actions=actions,
            action_data=action_data,
            tools_called=tools_called,
        )

    def _map_tool_to_ui_action(
        self, name: str, result: Dict[str, Any]
    ) -> tuple[Optional[str], Dict[str, Any]]:
        if not result.get("success"):
            return None, {}
        if name == "create_project":
            ui_data: Dict[str, Any] = {}
            project_name = (
                result.get("project_name")
                or result.get("suggested_name")
                or result.get("name")
            )
            if project_name:
                ui_data["project_name"] = project_name
            if result.get("path"):
                ui_data["path"] = result["path"]
            if result.get("project_type"):
                ui_data["project_type"] = result["project_type"]
            ui_action = result.get("action") or "create_project"
            return ui_action, ui_data
        if name == "compare_list":
            return "compare_list", {}
        if name == "scan_directory":
            return "open_scan", {
                "path": result.get("root_path"),
                "dirs": result.get("dirs", []),
            }
        if name == "discover_tools":
            return "show_tool_discovery", {
                "found": result.get("found", False),
                "repos": result.get("repos", []),
                "query": result.get("query", ""),
            }
        return None, {}

    def _build_messages(
        self,
        message: str,
        history: List[Dict[str, str]],
        project_id: Optional[str] = None,
    ) -> List[Dict[str, str]]:
        messages = [{"role": "system", "content": self.build_system_prompt(project_id)}]
        messages.extend(self._format_history(history))
        messages.append({"role": "user", "content": message})
        return messages
    
    async def chat_stream(
        self,
        message: str,
        history: List[Dict[str, str]],
        api_config_id: Optional[str] = None,
        project_id: Optional[str] = None,
        tool_executor: Optional[ToolExecutor] = None,
    ) -> AsyncGenerator[str, None]:
        """流式对话：工具调用阶段非流式，最终回复逐字输出"""
        result = await self.chat(
            message=message,
            history=history,
            api_config_id=api_config_id,
            project_id=project_id,
            tool_executor=tool_executor,
        )
        if isinstance(result, ChatWithToolsResult):
            text = result.reply
        else:
            text = str(result)
        for char in text:
            yield char

    async def _chat_plain(
        self,
        messages: List[Dict[str, Any]],
        api_config: Dict[str, Any],
    ) -> ChatWithToolsResult:
        """无工具的普通对话（供测试、摘要等内部调用）"""
        client = self._create_client(api_config)
        model = api_config.get("model", "gpt-4o-mini")
        response = await client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.7,
            max_tokens=2048,
        )
        return ChatWithToolsResult(
            reply=response.choices[0].message.content or ""
        )

    async def chat(
        self,
        message: str,
        history: List[Dict[str, str]],
        api_config_id: Optional[str] = None,
        project_id: Optional[str] = None,
        tool_executor: Optional[ToolExecutor] = None,
        use_tools: bool = True,
    ) -> ChatWithToolsResult:
        """
        非流式对话，支持 Function Calling 与工具结果回传。
        """
        api_config = self.resolve_api_config(api_config_id)
        if not api_config:
            return ChatWithToolsResult(
                reply="错误：没有可用的API配置，请在设置中添加并启用LLM API"
            )

        if not api_config.get("api_key"):
            return ChatWithToolsResult(
                reply="错误：API密钥未配置，请设置环境变量 LLM_API_KEY 或在设置中填写 api_key"
            )

        try:
            messages = self._build_messages(message, history, project_id)
            tools = self._build_openai_tools() if use_tools else []
            if not use_tools or not tools:
                return await self._chat_plain(messages, api_config)

            if tool_executor is None:
                from backend.skills import skill_manager

                async def _default_executor(name: str, args: Dict[str, Any]) -> Dict[str, Any]:
                    return await skill_manager.execute(name, **args)

                tool_executor = _default_executor

            return await self._chat_with_tools_loop(
                messages, api_config, tool_executor
            )
        except Exception as e:
            return ChatWithToolsResult(reply=self._sanitize_error(e))
    
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
            意图字符串：create_project/search_old_project/compare_list/query_spec/merge_tuding/scan_directory/general
        """
        intent_prompt = f"""请分析用户消息的意图，返回以下其中一个意图代码：

- create_project: 用户想要创建新项目
- search_old_project: 用户想要搜索或匹配旧项目
- compare_list: 用户想要对比清单
- query_spec: 用户想要查询规范或标准
- merge_tuding: 用户想要合并兔钉导出数据
- scan_directory: 用户想要扫描、浏览或列出某个磁盘/文件夹中的项目（不一定已给出完整路径）
- general: 其他通用对话

示例：
- "扫描E盘" → scan_directory
- "看看我的项目文件夹" → scan_directory
- "我想看看E盘有什么项目" → scan_directory
- "列出E盘的文件" → scan_directory

用户消息：{message}

只返回意图代码，不要返回其他内容。"""
        
        try:
            api_config = self.resolve_api_config()
            if not api_config or not api_config.get("api_key"):
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
            valid_intents = [
                "create_project",
                "search_old_project",
                "compare_list",
                "query_spec",
                "merge_tuding",
                "scan_directory",
                "general",
            ]
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

        # 扫描目录意图
        scan_keywords = ["扫描目录", "扫描文件夹", "扫描文件", "访问目录", "访问文件夹"]
        if any(kw in message_lower for kw in scan_keywords):
            return "scan_directory"
        
        return "general"


# 创建全局LLM引擎实例
llm_engine = LLMEngine()