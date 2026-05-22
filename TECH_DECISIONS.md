# 技术细节确认 —— 直接复制给Continue

你是FindWay Agent的开发者。以下是对你提出的8个问题的逐一确认。

---

## 1. LLM API配置

**当前阶段：先用模拟回复，不接真实LLM。**

- **Phase 1（当前）**：`backend/api/chat.py` 用关键词意图识别（纯Python逻辑，不需要API）
  - 用户说"创建项目" → 匹配关键词 → 调用projects API → 返回固定回复模板
  - 用户说其他内容 → 返回引导性欢迎语
- **Phase 2+（后续）**：接入LLM API时，在 `config.json` 中配置：
  ```json
  {
    "llm": {
      "provider": "openai_compatible",
      "api_key": "从环境变量 LLM_API_KEY 读取",
      "base_url": "https://api.openai.com/v1",
      "model": "gpt-4o-mini"
    }
  }
  ```
- **不接本地模型**（Ollama太重），先走云端API
- **API Key 放在环境变量**，不写死在代码里

---

## 2. DWG读取技术

**当前阶段：先装依赖搭框架，暂不实现功能。**

- 使用 **ezdxf** 库（纯Python，pip安装即可，不需要额外软件）
- `cad-viewer` skill 路径 `~/.workbuddy/skills/cad-viewer` 存在但需要验证
- **Phase 5 才实现CAD功能**，现在只需：
  - 创建 `backend/engine/cad_engine.py` 空文件
  - 安装 ezdxf：`venv/Scripts/pip install ezdxf`
  - 不需要写具体逻辑

---

## 3. 规范库数据

**先搭框架，数据后填。**

- Phase 1-4 不需要规范库
- 规范查询接口先写个壳：
  ```python
  @router.get("/api/spec/search")
  async def search_spec(query: str):
      return {"results": [], "message": "规范库数据暂未导入"}
  ```
- 数据来源：后续我（PM）会整理常用GB/JGJ/CJJ条文，以JSON格式导入

---

## 4. 兔钉网对接

**不做。** 兔钉网是用户手动使用的SaaS工具，不需要程序对接。

---

## 5. GUI技术栈

**本地Web方案（React + Vite），不打包桌面应用。**

- 前端：React 18 + Vite 5，在浏览器 `localhost:5173` 运行
- 后端：FastAPI，在 `localhost:8765` 运行
- 暂不用 Electron / Tauri（等核心功能稳定后再考虑加壳）
- 启动方式：双击 `start.bat` → 自动打开浏览器

---

## 6. 数据存储

**只用JSON文件，不用SQLite。**

- 项目数据：`backend/data/projects_index.json`
- 聊天历史：`backend/data/chat_history.json`
- 规范数据（后续）：`backend/data/specs.json`
- 配置文件：`backend/config.json`

原因：JSON对初学者友好，可以直接用记事本打开查看和修改。

---

## 7. 环境配置

| 项目 | 值 |
|------|-----|
| **项目根目录** | `E:\曹铭睿\findway_agent` |
| **代码目录** | `E:\曹铭睿\findway_agent\signage-app` |
| **Python版本** | ≥3.10（用户系统有3.14.5） |
| **Node.js版本** | ≥18（用户系统有v24.15.0） |
| **包管理** | npm / pip |
| **虚拟环境** | `signage-app\venv\` |

---

## 8. 启动脚本

`signage-app\start.bat` 需要做到：

1. **同时启动前后端**：后端先启动，等待就绪后再启动前端
2. **自动打开浏览器**：跳到 `http://localhost:5173`
3. **错误处理**：
   - 如果找不到 Python 或 venv → 显示明确错误 + `pause`（不闪退）
   - 如果端口被占用 → 提示用户手动关闭占用进程
4. **所有提示用英文**（避免中文编码乱码）
5. **后端窗口最小化**

---

## 确认完毕

以上8点全部确认。现在请开始 **Phase 0：环境搭建**。
