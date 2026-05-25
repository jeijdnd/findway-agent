⚠️ 先 git pull

@PROGRESS_BOARD.md

当前：V1全部完成 + V2 T01-T03/P0-3/P0-4完成。
最后一步：V2 P0-5 合并预览页 MergePreview.jsx

## 本次任务

### 只做前端：新建 frontend\src\pages\MergePreview.jsx

兔钉合并引擎（backend/services/merge_engine.py）已完成，现在做一个预览确认页面。

1. **上传区**
   - 两个拖放区：兔钉导出（.xlsx）+ 完整清单模板（.xlsx）
   - 或文件选择按钮

2. **调用合并引擎**
   - POST /api/merge/preview → 返回合并预览结果（不落盘）
   - 返回数据含：匹配统计（匹配N项 / 新增M项）、对比明细

3. **预览展示**
   - 汇总卡片：匹配项数、新增项数、总计
   - 明细表格：编号、名称、数量、状态列（匹配=正常/新增=黄色高亮）
   - 新增项黄色背景标注

4. **操作按钮**
   - "确认合并"按钮 → POST /api/merge/execute → 导出完整清单xlsx下载
   - "返回修改"按钮 → 清空重新上传

5. **三态覆盖**
   - Loading / Empty / Error

## API端点（后端已有）
- POST /api/merge/preview → 预览
- POST /api/merge/execute → 执行合并导出

## 约束
- 只新建 MergePreview.jsx 一个文件
- 需要在 AppLayout.jsx 中加第四个标签"合并预览"注册路由
- 合并引擎只读：preview不落盘，execute才导出

完成后：更新 PROGRESS_BOARD.md + SESSION_REPORT.md + git push。
