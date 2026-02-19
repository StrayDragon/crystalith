## 1. Shared retrieval module

- [x] 1.1 新建共享 retrieval 模块（输出：`resolved_chunk_ids`, `context_text`, `stats`）
- [x] 1.2 实现 token budget 截断（复用 `TokenCounter`/`ContextWindow` 的 retrieval 截断逻辑或提取 helper）

## 2. Dedup & diversity

- [x] 2.1 实现 chunk 去重与近似重复折叠（确定性规则）
- [x] 2.2 实现按 source 的 chunk 数上限（可配置，默认值写入 settings 或常量）

## 3. Integrate into outputs

- [x] 3.1 重构 OutputGraph ResolveContext 使用共享 retrieval 模块（替换现有分散逻辑）
- [x] 3.2 确保 citations 与 `resolved_chunk_ids` 行为与现有一致（回归验证）

## 4. Integrate into slides

- [x] 4.1 重构 slides context 构建使用共享 retrieval 模块（保留 chunk_ids 复用路径）
- [x] 4.2 确保 outline/markdown 两阶段 budget 与多样性一致生效

## 5. Optional: multi-query retrieval (quality)

- [ ] 5.1 引入 multi-query 开关（feature flag / settings）
- [ ] 5.2 实现质量优先下的多 seed 检索与合并（dedup + diversity 裁剪）

## 6. Verification

- [ ] 6.1 单测：budget 截断、去重、多样性裁剪、multi-query 合并策略
- [ ] 6.2 回归：对比接入前后的 outputs/slides 生成稳定性与时延（结合 observability）
