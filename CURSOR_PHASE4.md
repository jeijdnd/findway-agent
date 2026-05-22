@PROGRESS_BOARD.md

当前进度：Phase 0-3 完成。开始 Phase 4：开发者控制台。

## 本次任务（Phase 4）

### 4.1 后端：配置API

修改 `signage-app\backend\api\settings.py`（如不存在则新建）：

- `GET /api/settings`：读取 config.json 返回当前配置
- `PUT /api/settings`：更新 config.json，验证字段合法性
- `POST /api/settings/reload`：热重载配置（重新读文件）

config.json 结构参考：
```json
{
  "modules": {"project_matching": true, "list_compare": true, "cad_assist": false},
  "matching_rules": {"type_weight": 0.5, "keyword_weight": 0.5, "max_results": 5},
  "list_template": {"columns": ["编号","名称","尺寸","材质","单位","数量","备注"]}
}
```

### 4.2 前端：控制台页面

完善 `AppLayout.jsx` 中的 settings 标签页：

- 模块开关区：3个Toggle开关（旧项目匹配/清单对比/CAD辅助），每个有简短说明
- 匹配规则区：类型权重+关键词权重两个滑块（0-1，范围滑块），最大结果数输入框
- 清单模板区：显示当前列名，支持添加/删除/重排，"重置默认"按钮
- 保存按钮 → PUT /api/settings → 显示"已保存"
- 刷新按钮 → POST /api/settings/reload
- Loading/Error状态

## 完成后
更新 PROGRESS_BOARD.md（4.1/4.2 标记✅）和 SESSION_REPORT.md。
