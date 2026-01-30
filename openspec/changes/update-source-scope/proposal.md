## Why
当前对话与 Studio 输出会在“选中引用/自动检索”之间切换，用户无法确保只基于选中的来源生成结果；同时缺少明确的来源 embedding 状态提示与失败重嵌入入口，导致选中范围与实际检索结果不一致的疑惑。

## What Changes
- 仅保留“来源级别”作为最小选择单元，移除引用（chunk）级选择对上下文范围的影响。
- Chat / Studio / Slides 统一使用选中的 `source_ids` 作为上下文范围；未选中任何来源时，传空范围并由后端返回空上下文结果（无自动检索）。
- 后端 QA / Refine / Slides 接口支持 `source_ids` 作为显式检索范围，由后端解析为相关 chunk。
- 来源列表展示 embedding/索引状态标识，并对处理中/失败来源禁用选择；失败来源提供重新嵌入入口。

## Impact
- Specs: `rag-qa`, `refine-output`, `studio-slides`, `citation-interaction`, `workspace-ui`, `source-ingestion`
- Code: frontend source selection & request payloads; backend QA/refine/slides payload schemas & retrieval逻辑; OpenAPI 生成与相关测试
