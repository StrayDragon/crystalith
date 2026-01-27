## Why

目前 Studio 仅支持文本类结构化输出，缺少“演示/PPT”这一高频产出类型。我们需要在现有工作区逻辑下提供从素材到幻灯片的完整流程，并复用 slidev-ai 的成熟思路（输入 → 大纲 → Markdown → 预览）作为第一版实现。

## What Changes

- 新增 Studio 输出类型 `SLIDES`，中文标签为“演示”，在工具网格中可选。
- 引入三阶段生成流程（输入 → 大纲 → Markdown），支持 SSE 进度流与中断/重试。
- 支持大纲与 Markdown 编辑、保存与恢复，后端负责状态与数据持久化。
- 预览改为前端侧 Slidev CLI 服务（`frontend/packages/crystalith-slidev`），通过 iframe 嵌入到工作区 UI。
- 后端仅负责元信息/Markdown 持久化与生成，不再运行 Slidev CLI 预览构建。
- 保持接口中性：Slidev 作为首个引擎实现，但不锁死未来引擎扩展。

## Impact

- 受影响的规范：`workspace-ui`，新增 `studio-slides`
- 受影响的代码（预期）：
  - `backend/py/src/crystalith/outputs/types.py`
  - `backend/py/src/crystalith/api/outputs.py`（或新增 slides API 模块）
  - `backend/py/src/crystalith/agents/`（演示生成流程）
  - `backend/py/src/crystalith/db/models.py`（演示草稿/状态存储）
  - `backend/py/src/crystalith/studio/slides/`（生成与存储逻辑迁移）
  - `frontend/packages/crystalith-slidev/`（Slidev CLI 预览服务）
  - `frontend/web/src/features/workspace/components/`
