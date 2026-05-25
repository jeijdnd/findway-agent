⚠️ 先 git pull

@PROGRESS_BOARD.md

Bug：后端已启动（看到 "Application startup complete"），但 main.js 弹 "Backend Error" 窗口。

## 诊断

看日志：
- Python 后端实际已启动成功（Uvicorn running + Application startup complete）
- 但 Electron 的 `waitForBackend()` 或 health 检查超时或失败了

原因：main.js 里的健康检查可能：
1. 检查得太早（后端还没完全 ready）
2. 检查逻辑有 bug（比如只看进程退出，没看 http 响应）
3. 编码问题导致读取响应失败

## 修复

修改 electron/main.js：

1. **延长等待时间**：从 30 秒改到 60 秒（后端启动需要更久）

2. **调整 health 检查逻辑**：
   - 不要只看进程是否存活
   - 加一个简单的 http fetch 检查 `http://127.0.0.1:8765/api/health`
   - 成功响应 {"status":"ok"} 才算成功

3. **错误弹窗改进**：
   - 区分"后端启动中..."和"后端启动失败"
   - 如果是超时，提示"后端启动较慢，请重试"而不是直接报错

## 关键修改点

找到 main.js 中的：
- `waitForBackend()` 函数 → 延长超时、加 http 检查
- `startPythonBackend()` → 确保健康检查逻辑正确
- 错误弹窗 → 改进提示文字

## 约束
只改 electron/main.js。
不改后端代码。

完成后：git push。
