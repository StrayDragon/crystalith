## 1. Source ingestion substrate

- [ ] 1.1 定义 ingestion stages、artifacts 与 partial success 语义
- [ ] 1.2 定义 extractor fallback chain、failure classes 与 capture provenance
- [ ] 1.3 定义 content fingerprint、chunk metadata 与 canonical source 基础

## 2. Dedup and delta indexing

- [ ] 2.1 定义 duplicate groups、merge/ignore/park 与 alias/redirect 规则
- [ ] 2.2 定义 source change log、delta plan 与 refresh trigger 边界
- [ ] 2.3 定义 chunk revisions、delta rechunking 与增量 index rebuild 规则

## 3. Visibility and diagnostics

- [ ] 3.1 定义 refresh visibility lifecycle 与 staleness diagnostics
- [ ] 3.2 定义 sources panel / diagnostics 面如何消费 provenance 与 dedup 解释
- [ ] 3.3 复核 dedup / provenance / delta indexing 语义互相支撑

## 4. Verification

- [ ] 4.1 复核 merged proposal 已吸收 6 个旧 change 的关键约束
- [ ] 4.2 复核没有留下平行的 source identity 或 refresh 真相
- [ ] 4.3 运行 `openspec validate c4081-source-ingestion-provenance-dedup-and-delta-indexing`
