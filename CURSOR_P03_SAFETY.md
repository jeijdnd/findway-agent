## Cursor: P3 — 安全沙箱（Dual Agent）

@PROGRESS_BOARD.md

### 需求
Agent A（执行者）调用工具 → Agent B（审核者）检查安全性 → B 放行则执行，否则拦截。

### 架构

```
用户消息 → LLM (Agent A) → tool_calls
                ↓
         审核层 (Agent B)
         ├── 安全 → 执行
         └── 危险 → 拦截，返回原因
```

### 实现

#### 1. 审核规则（backend/services/safety_auditor.py）

```python
class SafetyAuditor:
    DANGER_PATTERNS = [
        r"rm\s+-rf",           # 删除系统文件
        r"format\s+\w:",       # 格式化磁盘
        r"del\s+/S\s+/Q",      # 强制删除
        r"shutdown",           # 关机
        r"reg\s+(add|delete)", # 注册表
        r">>\s*C:\\Windows",   # 写入系统目录
    ]
    
    RESTRICTED_DIRS = [
        "C:\\Windows", "C:\\Windows\\System32",
        "C:\\Program Files", "%APPDATA%\\..\\Windows"
    ]
    
    def audit(self, skill_name: str, parameters: dict) -> AuditResult:
        """审核工具调用是否安全"""
```

#### 2. 双重 LLM 审核（可选增强）
- 简单规则命中 → 直接拦截
- 不确定 → 调用独立 LLM 判断
- 审核提示词："检查以下操作是否安全..."

#### 3. 集成到 chat.py
`_execute_tool()` 调用前先走审核：
```python
result = safety_auditor.audit(skill_name, arguments)
if not result.allowed:
    return {"reply": f"操作被拦截: {result.reason}", "action": None}
```

#### 4. 前端
- 被拦截时展示黄色警告卡片
- "请求放行"按钮（呼叫用户手动确认）
- 设置页可调整审核严格度（宽松/标准/严格）

#### 5. 设置页新增
- 「安全」标签
- 审核规则开关列表
- 审核日志：最近 50 条审核记录

### 约束
- 不改现有工具
- 默认审核严格度：标准
- 审核日志存 %APPDATA%/FindWay-Agent/safety_log.json

完成后 git push。
