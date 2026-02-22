# studio-slides Specification

## Purpose

作为 SLIDES（演示）输出在 Studio 中的“总览/导航”规范：定义以 slides draft 为核心的三阶段工作流（input → outline → markdown），并通过 SSE 提供可观察的生成进度；markdown 可被保存并用于 Slidev 预览与导出。

本规范不重复 API 细节；draft/stream/preview 的稳定契约分别见下述聚焦 specs。

## Related specs

- `GLOSSARY.md`
- `workspace-studio-ui/spec.md`（Studio 工具入口与 preference 传播）
- `workspace-api/spec.md`（slides 端点入口与 tools config）
- `generation-preference/spec.md`
- `generation-retrieval/spec.md`
- `studio-slides-drafts/spec.md`（draft 资源与 Output 同步）
- `studio-slides-sse/spec.md`（SSE 事件与 busy/error/done 契约）
- `studio-slides-preview/spec.md`（预览同步与共享预览文件）

## Requirements

### Requirement: SLIDES tool entrypoint (Studio)
系统 MUST 在 Studio 工具网格中提供 `SLIDES` 类型入口，并绑定当前 notebook 上下文。

### Requirement: Draft-centric three-stage workflow
系统 MUST 以 slides draft 驱动三阶段流程：

1. input：用户填写 title/prompt/config，并选择 sources
2. outline：生成/编辑大纲并保存
3. markdown：生成/编辑 Slidev Markdown 并保存
用户关闭后再次打开 slides 时，系统 MUST 从后端加载 draft 并恢复到已保存阶段（见 `studio-slides-drafts/spec.md`）。

### Requirement: Generation streams are stage-specific
系统 MUST 使用 SSE 端点分别生成 outline 与 markdown，并支持“串联生成”（先 outline 后 markdown）。
用户选择“生成全部”时，客户端 MUST 依次调用 outline stream 与 markdown stream（见 `studio-slides-sse/spec.md`）。

### Requirement: Preview uses latest saved markdown
系统 MUST 支持 Slidev 预览，且预览使用“最新保存的 markdown”作为输入（见 `studio-slides-preview/spec.md`）。
