# rag-qa Specification

## Purpose

定义基于检索增强生成（RAG）的问答能力：回答必须受 notebook/source 范围约束，并返回可解析的 citations；在缺少证据时明确提示；同时对关键阶段进行并行化以降低端到端延迟。

## Related specs

- `GLOSSARY.md`
- `generation-retrieval/spec.md`
- `source-ingestion/spec.md`
- `workspace-api/spec.md`
- `citation-interaction/spec.md`
## Requirements
### Requirement: 基于检索的回答
系统 SHALL 仅基于当前 Notebook 内已索引的来源回答问题，并将回答范围约束在检索到的上下文内。

### Requirement: 内联引用
系统 SHALL 在回答中提供可解析的引用信息（指向来源名称与对应片段；数据模型见 `workspace-api/spec.md`）。

### Requirement: 无证据提示
当未检索到高于阈值的证据时，系统 SHALL 明确提示缺乏足够信息（并与 `evidence=false` / 空 citations 一致）。

### Requirement: 显式来源范围问答
系统 MUST 支持在 QA 请求中提供选中来源的 `source_ids`，并仅使用这些来源检索并构建回答上下文。

最小行为：
- 提供 `source_ids` 时系统 MUST 仅从这些来源检索上下文并生成回答，且 citations MUST 仅来自这些来源
- 未提供 `source_ids` 或 `source_ids` 为空时系统 MUST 不执行检索并返回无证据提示（citations 为空或 `evidence=false`）
- `source_ids` 包含不属于当前 notebook 的来源时系统 MUST 返回 400 并说明无效来源范围

### Requirement: 流式与非流式 QA 的检索元信息一致
系统 MUST 保证同一输入在非流式 QA 与流式 QA（以 `done` 事件为准）返回一致的检索与引用元信息：

- `citations` 数组（内容与顺序）
- `evidence` 布尔值
- `confidence` 数值
- `context` 统计字段（若存在）

### Requirement: RAG 管道并行化
系统 MUST 在 RAG Q&A 流程中将无依赖的操作并行执行，减少端到端延迟。

带 `session_id` 的请求 SHOULD 并行执行“问题嵌入”和“会话历史获取”，两者完成后再进行向量搜索；不带 `session_id` 时系统 MUST 仅执行问题嵌入而不引入额外等待。

### Requirement: AI Provider 超时与重试
系统 MUST 为 AI provider 调用配置可选的超时和重试策略，提升外部服务不稳定时的可用性。
最小行为：超时/限流（429）等可重试错误触发重试并采用指数退避；达到最大重试次数后返回最后一次错误，并记录重试日志。

### Requirement: OutputType-aware Query Seeds
系统 SHOULD 基于 `OutputType` 为 multi-query 生成额外的 query seeds/hints，以提高检索覆盖稳定性。

当 `output_type=TIMELINE` 且启用 multi-query 时，seeds SHOULD 更关注日期/事件抽取提示（不泄露实现细节）。multi-query 启用时系统 MUST 将 seeds 数量限制在可配置上限内。

### Requirement: QA completion logic MUST be shared across stream and non-stream paths
系统 MUST 在流式与非流式 QA 路径中复用同一套完成阶段逻辑（消息持久化、context 统计映射、完成元信息构造），避免重复实现导致行为漂移。

#### Scenario: No-evidence completion remains consistent
- **WHEN** 同一输入在 stream/non-stream 路径均命中“无证据”分支
- **THEN** 两条路径都会使用共享完成逻辑持久化消息，并返回一致的 `evidence=false` 与空 citations 元信息

#### Scenario: Evidence completion remains consistent
- **WHEN** 同一输入在 stream/non-stream 路径命中“有证据”分支
- **THEN** 两条路径都会使用共享完成逻辑持久化消息，并返回一致的 citations/confidence/context 元信息
