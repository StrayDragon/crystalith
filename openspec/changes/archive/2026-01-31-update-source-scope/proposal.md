## Why
当前代码已经大幅转向来源级选择，但仍残留引用（chunk）级选择/比较/复制状态与 `chunk_ids` 兼容路径，造成范围语义不一致与维护成本。同时 Studio 输出在未选中来源时仍可触发空上下文生成，用户期望被明确阻止。需要一次性移除引用级范围与 `chunk_ids` 支持，统一为来源级范围，并补齐范围校验与 UI 阻断。

## What Changes
- 仅保留“来源级别”作为最小选择单元，彻底移除引用（chunk）级选择/比较/复制 UI 与状态。
- 移除 `chunk_ids` 兼容输入（破坏性变更）；后端仅接受 `source_ids` 作为显式范围。
- Chat / Refine 允许空来源范围并返回空上下文/无证据；Studio 输出与 Slides 要求至少选中一个来源，未选中时前端禁止触发且后端返回 400。
- Slides 对无效 `source_ids` 明确返回 400 校验错误（替代通用 SSE 错误）。
- 来源列表展示 embedding/索引状态标识，并对处理中/失败来源禁用选择；失败来源提供重新嵌入入口（复用现有 re-embed 接口）。

## Impact
- Specs: `rag-qa`, `refine-output`, `studio-slides`, `citation-interaction`, `workspace-ui`, `source-ingestion`
- Code: frontend source selection & Studio 按钮状态; backend QA/refine/outputs/slides payload schemas & retrieval逻辑; OpenAPI 生成与相关测试
