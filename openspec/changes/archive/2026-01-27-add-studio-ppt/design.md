## Context

- 现有 Studio 输出以单步请求完成，缺少多阶段状态与预览能力。
- slidev-ai 已验证的流程是「输入 → 大纲 → Markdown → 预览」，并通过 SSE 输出进度。
- Crystalith 需要在不新增独立页面的前提下，将演示生成纳入现有工作区逻辑（Notebook + 选中引用）。

## Goals / Non-Goals

- Goals:
  - 新增 `SLIDES` Studio 输出类型，支持三阶段生成与状态恢复。
  - 由后端管理流程状态、数据持久化与 SSE 进度。
  - 由前端侧 Slidev CLI 服务提供预览能力（iframe 嵌入）。
- Non-Goals:
  - 不实现 slidev-ai 的导入、部署、主题管理等完整功能集。
  - 不提供引擎选择 UI（仅预留扩展空间）。
  - 不引入新的工作区页面或路由。

## Decisions

- Decision: 新增演示草稿数据模型（如 `studio_slides`）存储 outline、markdown、stage/status、engine、关联 notebook/output。
  - Alternatives considered: 直接把所有内容塞进 Output.content
  - Reason: Output.content 不适合多阶段状态与文件路径；独立模型更清晰。

- Decision: 生成流程采用两次 LLM 调用（大纲、Markdown），并通过 SSE 事件流输出进度。
  - Alternatives considered: 单次生成完整 Markdown
  - Reason: 三阶段流程可编辑、可重跑，且符合 slidev-ai 成熟实践。

- Decision: 预览由前端侧 Slidev CLI 服务提供，React 通过 iframe 嵌入。
  - Alternatives considered: 后端集中运行 CLI / 前端纯运行时渲染
  - Reason: 避免“后端里还有前端”，保留 Slidev 高级能力，同时让后端只负责数据与生成。

- Decision: 预览服务使用固定预览入口文件（`data/output/preview/slides.md`），由后端在 Markdown 保存时同步更新。
  - Alternatives considered: 每个演示独立启动 Slidev 服务
  - Reason: 降低首版复杂度与资源占用，预览一致性由“最后一次保存”驱动。

- Decision: 引擎字段 `engine` 默认 `slidev`，当前不暴露选择 UI。
  - Alternatives considered: 直接固定为 slidev
  - Reason: 满足“slidev 只是首个实现”的方向，且不增加首版 UI 复杂度。

## Risks / Trade-offs

- Slidev CLI 依赖与启动耗时：需要清晰的启动说明与失败提示。
- SSE 长连接与并发冲突：需使用锁或队列控制同一演示的并发生成。
- 预览文件为全局入口：多会话并发时可能互相覆盖（首版可接受，后续可拆分为独立实例）。

## Migration Plan

1. 新增/确认演示草稿数据模型与生成流程。
2. 后端保留大纲/Markdown API，移除 Slidev CLI 预览接口。
3. 前端新增 Slidev CLI 预览服务包，并在 Studio 中 iframe 嵌入。
4. 更新 OpenAPI 与前端 SDK（`pnpm run api:generate`）。

## Open Questions

- 演示文件与预览产物的存储目录是否统一放在 `data/` 下？
> ok的, data/output/<notebook_id>/<slide-id>/*

- 预览服务的端口与访问范围（仅本机/内网/公网）需要哪些限制？
> 暂时不需要任何安全限制，但需在说明中备注仅用于本地开发。

- 是否需要在首版提供主题选择或默认主题即可？
> 暂时只默认主题
