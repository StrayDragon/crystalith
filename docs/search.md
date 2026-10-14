# 知识库全局搜索（c132）

顶栏搜索框（默认「本地知识库」模式）背后的产品面：`POST /v2/search` 单端点，
语义（KNN）+ 关键词（FTS bm25）双通道 RRF 融合，范围可全局（跨全部笔记本）或限定单笔记本。
规格 SSOT：`llmanspec/specs/global-search/global-search.feature`（r484–r489）。

## 索引对象范围（会被搜到什么）

| 对象             | 入索引方式                                                             | origin_type |
| ---------------- | ---------------------------------------------------------------------- | ----------- |
| 来源资料块       | 摄取管线上传 / URL / 会话转来源 / QA 转来源                            | `source`    |
| 产出（全部类型） | 生成成功后**同步**自动派生索引（隐藏行，`derived_output_id` 指回产出） | `output`    |

- 派生行不出现在任何用户可见的来源列表/统计；删除产出级联清理派生行、块、向量与 FTS。
- 既有引用语义零变化：QA / 产出生成 / studio / 单源 QA / research 检索默认只检索
  `origin_type='source'`（r486），产出只经全局搜索可见。
- 搜索结果条目携带跳转引用：source → 来源详情 + 块高亮；output → 产出查看器。

## 中文关键词质量（r487）

- `chunks.text_tokens` 列存应用侧分词结果：CJK 滑窗 bigram + 拉丁整词小写
  （`apps/server/src/rag/cjk-tokenizer.ts`）；`chunks_fts`（FTS5 外部内容表）索引该列。
- 查询侧同样 bigram 化后以 OR 组合交给 bm25 排序——两字中文词（如「向量」）可命中。
- 历史块由 boot `ensureFtsIndex` 幂等回填并重建索引；旧形态表（索引原文 `text`）自动迁移。

## 降级语义（r488）

| 状态           | 行为                                                          |
| -------------- | ------------------------------------------------------------- |
| 正常           | 双通道融合，完整结果                                          |
| 重建中 / 中断  | 跳过语义通道，关键词照常出结果 + `degraded: index_rebuilding` |
| 维度不匹配     | 同上 + `degraded: dim_mismatch`                               |
| 嵌入网关不可用 | 同上 + `degraded: embed_unavailable`                          |

搜索框永不说「不可用」；响应 `degraded` 字段显式标注语义通道缺席（不静默）。
产出自动索引的嵌入失败不拖垮生成——派生行标 failed，`GET /v2/notebooks/:nid/search-index`
的 `derivedFailedCount` 可见，索引重建即恢复。

## 性能预算与取消边界（r489）

- 配置（`config/app.yaml` `search.kb`）：`default_top_k`（20）/ `max_top_k`（100，
  请求 topK 被钳制；wire 层另有 500 硬上限）/ `budget_ms`（10000）。
- **取消边界**：SQLite 同步执行不可中断——预算是观测性预算（超限打 warn 日志），
  不是抢占；topK 与各通道 LIMIT 是真正的硬界。嵌入网关调用沿用引擎自身超时/重试。
- 真机实测（2026-10-14，`data/crystalith.db`，6 chunks，EG2 网关，混合通道全程在线，
  n=20 请求混合中文/英文查询）：**p50 = 33ms，p95 = 92ms，max = 92ms**（首请求含嵌入
  连接冷启动）。数据规模小时嵌入网络往返主导；本地 KNN/FTS 为毫秒级。数据规模增长后
  若 p95 超预算，启用 design.md D6 备选（notebook 级并行扇出 + 轮转合并）。
