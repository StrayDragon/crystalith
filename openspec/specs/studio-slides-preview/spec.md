# studio-slides-preview Specification

## Purpose

定义 SLIDES 的预览同步契约：后端如何把最新 markdown 写入共享预览文件，独立的 Slidev preview 服务如何读取并渲染，以及前端在预览不可用时的降级策略。

本规范只覆盖预览链路；draft 保存语义见 `studio-slides-drafts/spec.md`。

## Related specs

- `GLOSSARY.md`
- `workspace-studio-ui/spec.md`
- `studio-slides-drafts/spec.md`
- `studio-slides-sse/spec.md`

## Requirements

### Requirement: Preview is rendered by an external Slidev service
系统 MUST 支持演示预览：预览由独立的 Slidev preview 服务提供（见 `frontend/packages/crystalith-slidev`），前端通过 iframe 或新窗口打开 preview URL。

Slidev preview 服务未启动或不可达时，前端 MUST 提示预览不可用，且 MUST NOT 阻塞编辑/生成/导出。

### Requirement: Backend writes shared preview markdown file
系统 MUST 将“最新保存/生成的 markdown”写入共享预览文件：

- `data/output/preview/slides.md`

该文件作为 Slidev preview 服务读取并渲染的输入。
客户端保存 markdown 或 SSE 生成成功时，后端 MUST 写入共享预览文件。

### Requirement: Backend writes per-slide markdown file
系统 SHOULD 将每个 draft 的 markdown 写入 slide 级文件，便于持久化与排障：

- `data/output/{notebook_id}/{slide_id}/slides.md`
markdown 被保存或生成时，对应 slide 级文件 SHOULD 更新为最新内容（支持重启后排障/回放）。

### Requirement: Frontend preview flow saves markdown first
前端在进入预览前 MUST 先保存当前编辑器中的 markdown 到后端（以保证预览渲染的是最新内容），再加载 preview URL。
用户点击“预览/刷新预览”时，前端 MUST 先触发保存 markdown，再刷新 iframe（必要时通过 cache-busting 参数强制刷新）。
