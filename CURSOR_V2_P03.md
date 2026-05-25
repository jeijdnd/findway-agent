⚠️ 先执行 git pull（本机可能不是最新代码）

@PROGRESS_BOARD.md

当前：V1全部完成 + V2 T01/T02/T03完成。
下一步：V2 P0-3 多API配置前端接入（后端已就绪，只做前端）。

## 本次任务

### 只改1个文件：signage-app\frontend\src\pages\Settings.jsx

在现有的控制台页面中，新增一个"LLM API 配置"区块：

1. **API列表展示**
   - 从 GET /api/llm-configs 获取已配置的API列表
   - 每行显示：名称、模型、base_url、启用/禁用开关、编辑/删除按钮
   - 当前激活的API高亮

2. **添加/编辑API表单**（弹窗或展开式均可）
   - name（必填，如"硅基流动"、"DeepSeek"）
   - base_url（必填，如"https://api.siliconflow.cn/v1"）
   - api_key（密码式输入，显示为***）
   - model（必填，如"deepseek-v3"）
   - enabled（开关）

3. **操作按钮**
   - "添加API"按钮 → 打开空白表单
   - 编辑按钮 → 打开预填表单
   - 删除按钮 → confirm确认 → DELETE /api/llm-configs/{id}
   - "重新加载配置"按钮 → POST /api/llm-configs/reload

4. **状态覆盖**
   - Loading / Empty("暂无API配置，请添加") / Error+重试

## API端点（后端已有，直接用）
- GET /api/llm-configs → 返回 {"apis": [...], "active": "id"}
- POST /api/llm-configs → 新建
- PUT /api/llm-configs/{id} → 更新
- DELETE /api/llm-configs/{id} → 删除
- POST /api/llm-configs/reload → 热重载

## 约束
- 只改 Settings.jsx 一个文件
- 保持现有的模块开关/规则滑块功能不受影响
- API key 输入框 type="password"，不暴露在页面上

完成后：更新 PROGRESS_BOARD.md + SESSION_REPORT.md + git push。
