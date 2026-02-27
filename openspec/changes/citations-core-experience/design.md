## Context

后端已在 QA/生成链路中返回 citations（含 source_id/chunk_id/chunk_index 等），并在 Workspace 侧具备“打开来源详情/定位来源”的基础交互。但缺少：
- citation 的上下文拉取接口（只能看 snippet，无法快速复查）。
- 导出能力（对外分享/写作时证据链丢失）。
- 跨不同输出类型与路径的字段一致性保证。

## Goals / Non-Goals

**Goals:**
- 将 citations 从“存在”升级为“可验证”：支持上下文复查与稳定定位。
- 让导出成为一等能力：用户可带引用导出，且结构对第三方消费友好。
- 保持 API 向后兼容：新增字段/端点优先，避免破坏既有客户端。

**Non-Goals:**
- 不在本变更中重做检索/压缩算法或提示词策略（仅提供可调参入口与可解释性）。
- 不引入复杂的权限体系或多租户导出治理。

## Decisions

- **Citation context 端点**：新增按（notebook_id, chunk_id）或（source_id, chunk_index）查询上下文的端点，返回：
  - snippet 的来源、chunk 元信息（页码/段落）
  - 前后文（可配置窗口大小）
- **导出格式**：
  - Markdown：正文 + 引用脚注/清单 + 来源列表
  - JSON：结构化对象（answer/output + citations + sources 元信息）
- **导出入口**：导出功能入口设为全局（例如命令面板/全局工具栏），并可在 Chat/Outputs 提供快捷入口。
- **一致性校验**：为 citations 增加后端 contract 测试，确保 QA/messages/outputs 在关键字段上不漂移。
- **前端统一组件**：抽出单一 CitationView/CitationDrawer 组件，Chat 与 Output 复用，避免分散实现导致行为不一致。

## Risks / Trade-offs

- [新增端点导致 OpenAPI 变化与生成客户端漂移] → 在 CI 中维持 api-check 与 generated client drift check；提供明确同步命令。
- [上下文返回过大影响性能] → 限制默认窗口大小，支持分页/截断；必要时增加缓存。
- [历史数据缺字段] → 缺失字段时保证 UI 有降级显示（unknown source）并可提示“同步来源列表”。

## Migration Plan

- 先新增端点与响应字段（向后兼容）。
- 前端逐步切换到统一组件；旧交互保留一段时间后移除。

## Open Questions

- （无）
