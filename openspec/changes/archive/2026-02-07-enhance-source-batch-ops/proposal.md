## Why

当前 source 管理仅支持单个操作（逐个上传、逐个删除），缺少批量操作能力。当用户需要管理大量 source（批量导入文档、清理旧 source、组织分类）时效率低下。批量操作和标签管理可显著提升 source 管理的效率。

## What Changes

- 支持 source 多选（Ctrl+Click、Shift+Click、全选）
- 批量删除、批量 re-embed 操作
- 文件批量上传（拖拽多个文件、选择多个文件）
- Source 标签系统（创建、分配、按标签筛选）
- Source 列表排序（按名称、日期、大小、类型）

## Impact

- 受影响的规范：`source-ingestion`（MODIFIED），`workspace-ui`（MODIFIED）
- 受影响的系统：
  - 后端 source API（批量操作端点）
  - 前端 SourcesPanel（多选、批量操作栏）
  - 数据库 schema（source 标签表）
