## Why

当前思维导图功能虽然有基础的可视化，但缺乏编辑能力和高级交互。用户无法修改节点、添加新分支，也无法进行协作和演示。

## What Changes

- **可编辑节点**：支持双击编辑节点文本
- **拖拽重组**：支持拖拽节点改变层级和位置
- **添加/删除节点**：支持快捷键和右键菜单操作
- **节点样式**：支持自定义节点颜色、图标、形状
- **连接线样式**：支持直线、曲线、折线等连接样式
- **演示模式**：支持逐级展开的演示模式
- **协作编辑**：支持多人实时协作编辑
- **多种布局**：支持树形、放射状、组织架构等布局

## Impact

- 受影响的规范：`workspace-ui`, `refine-output`
- 受影响的代码：
  - `frontend/web/src/features/workspace/plugins/allPlugins.tsx`
  - `frontend/web/src/features/workspace/components/MindmapViewer.tsx`
  - `backend/py/src/crystalith/outputs/generators/mindmap.py`
  - `backend/py/src/crystalith/db/models.py`（扩展 Output 支持增量更新）
