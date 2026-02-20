## Context

当前 multi-query retrieval 流程大致为：
- 基于 seed prompt 生成 2-3 条 query seeds
- 对每条 seed 生成 embedding，并分别执行向量检索（或 `search_many`）
- 合并结果：以 chunk_id 去重后取最大 score，并按 score 排序
- 再执行去重/多样性（按来源 cap + 文本 hash 去重）与 token budget 截断

现有合并策略的核心问题是：多 query 的 score 不一定可直接比较，且“取最大 score”会被单一 query 的高分条目支配，难以体现 multi-query 的集体信号。

## Goals / Non-Goals

**Goals:**
- 让 multi-query 合并更稳健：奖励“跨 query 均高排名”的 chunk，减少单 query 噪声支配。
- 保持可控成本：seed 数与排序算法时间复杂度可预测，并与 tuning 协同。
- 让 seeds 更贴近 OutputType 的检索意图（例如 timeline 更关注日期/事件，quiz 更关注定义/概念点）。
- （可选）为检索“组装/格式化”增加短 TTL 缓存以降低重复开销。

**Non-Goals:**
- 不引入复杂的学习排序或外部 reranker（先用轻量 rank fusion）。
- 不改变向量库 provider 的对外 API 形状（保持 search/search_many 兼容）。

## Decisions

### 1) 使用 Rank Fusion（RRF）作为 multi-query 合并默认策略

采用 Reciprocal Rank Fusion（RRF）合并各 query 的排名列表：
- 对每个 query 的 top_k 结果按 rank 计算 `1/(k + rank)` 分数（k 为常数）
- 对同一 chunk_id 跨 query 累加
- 按融合分数排序

理由：RRF 不依赖不同 query 的 score 可比性，且对噪声更稳健；实现简单、可测试。

### 2) seeds 生成改为“OutputType hint + seed_text”体系

- 保持 seed_text（用户 prompt）永远参与
- 为不同 OutputType 提供可控的 hint 列表（例如：timeline 添加“dates/events”，briefing 添加“recommendations/risks”）
- 最终 seeds 数受 tuning/上限约束（避免成本失控）

理由：多 query 的价值来自“从不同角度问同一问题”；OutputType 是天然的角度来源。

### 3) 保持现有去重/多样性与 budget 截断

RRF 只替换“合并/排序”阶段，其余去重、按来源 cap、token budget 截断保持不变（避免引入太多变量）。

### 4) （可选）增加检索组装缓存（短 TTL）

缓存粒度：`retrieve_context` 的“最终 chunk_ids + context_text（或 chunk_ids）”。
Key 维度：notebook_id、source_ids、effective seeds、top_k/min_score、OutputType、preference、模型 tokenizer id（若影响 budget）。

理由：同一笔记在短时间内重复生成多个输出类型时，检索与格式化可能高度重复；短 TTL 缓存可降低 DB/format 开销。

## Risks / Trade-offs

- [RRF 可能降低单 query 极高相关性] → 通过 top_k 与融合常数调参；保留“最大 score”作为可选策略或回退。
- [seeds 增加导致成本上升] → seeds 数必须受 tuning 限制；默认保持小规模。
- [缓存 key 维度复杂] → 先做最小可用 key（只缓存 chunk_ids），避免缓存爆炸。

## Migration Plan

- 先引入 RRF 合并并保持 seeds 数不变，验证质量稳定性与耗时变化。
- 再引入 OutputType hints 与 seeds 上限，观察 query_count 与质量收益。
- 最后按需要引入短 TTL 缓存，并在 Redis 场景下压测命中率与内存占用。

## Open Questions

- RRF 是否需要结合“按来源 cap”的排序反馈（例如：先融合再 cap vs 先 cap 再融合）？
- 是否需要为 plugin output types 提供可选的 retrieval hints 扩展点？
