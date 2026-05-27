## Cursor: P2 — 渐进式权限（只读记住授权）

@PROGRESS_BOARD.md

### 需求
现在每次扫目录都弹确认框。改成：
- 只读操作（scan、read）→ 第一次弹窗确认，勾√"记住"后不再弹
- 写入操作（write、register）→ 每次弹窗确认

### 实现

#### backend/api/scanner.py
- request_permission() 返回新增字段：`rememberable: true`（scan/read 时）
- confirm_permission() 新增参数：`remember: bool`
- 如果 remember=true → 存到 %APPDATA%/FindWay-Agent/remembered_permissions.json
- _check_permission() 先查权限有效期，再查 remembered 表
- 记住的权限永久有效（用户可手动清除）

#### 前端 ChatPanel.jsx 或权限弹窗组件
- 确认框新增checkbox：「记住此授权，下次不再询问」
- （只读操作才有这个选项；写入操作不显示）

#### 设置页
- 新增 「权限管理」 标签
- 显示已记住的授权列表
- 支持逐个撤销或全部清除

### remembered_permissions.json 格式
```json
{
  "scan": ["E:\\MingRui\\_项目文件", "D:\\Projects"],
  "read": []
}
```

### 约束
- 不改现有功能
- 写入操作仍每次弹窗
- 权限可在设置页手动撤销

完成后 git push。
