## Decision

Citation **wire + UI** 统一为 camelCase，以 `packages/shared` `CitationSchema` 为 SSOT。

| 旧 wire         | 新 wire / UI   |
| --------------- | -------------- |
| source_id       | sourceId       |
| source_name     | sourceName     |
| chunk_id        | chunkId        |
| chunk_index     | chunkIndex     |
| page_number     | pageNumber     |
| paragraph_index | paragraphIndex |
| snippet / score | 同名           |

前端废弃 `sourceTitle`，一律 `sourceName`。`normalizeCitation` 不再做 snake→camel 映射；若仍保留，仅做 id 字符串化与缺省补齐。

## Alternatives

- **只改 UI、wire 保留 snake**：已证明易回归，否决。
- **双写 snake+camel**：增加合约面，否决。
- **wire 用 sourceTitle**：与常见 `sourceName` 命名不一致；采用 `sourceName`。

## Rollout

单次全量切换：shared schema → server emitters → web types/components/tests → BDD feature 字符串断言（若有）。无版本协商头。
