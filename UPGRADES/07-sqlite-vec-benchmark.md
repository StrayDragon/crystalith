# 07 — sqlite-vec Benchmark（实测）

> 在 **Bun 1.3.14 + sqlite-vec 0.1.9** 上实测，贴合 crystalith RAG 用法（cosine 相似、top-10、按 notebook 过滤）。
> 复现脚本见 [UPGRADES/_bench-sqlite-vec/](./_bench-sqlite-vec/)（`bun install sqlite-vec && bun run bench.ts`）。

## 结论速览

**sqlite-vec 在个人笔记本级规模（< 10 万 chunk）完全可用，且与 Bun + bun:sqlite 天然同库。** 关键阈值：

| 规模（chunk 数） | 单次查询 p50 | 评价 | 适用 |
|------|------|------|------|
| **1k** | **1.0 ms** | 瞬时 | 单个小 notebook / 试点 |
| **10k** | **8.3 ms** | 快 | 典型个人 notebook（~20 本中等 PDF 书） |
| **50k** | **40 ms** | 可接受 | 多 notebook / 资料密集用户 |
| **100k** | **80 ms** | 临界 | 重度用户；**带 notebook 过滤可降到 30ms** |

> 对比：crystalith 当前用 ChromaDB（HNSW ANN 索引），在百万级仍能保持 ms 级。但 sqlite-vec 是**暴力扫描**，换来的好处是**业务库 + 向量库同库、零外部服务、零索引构建**——这正是桌面 app 要的。

## 实测数据

### 环境

- Bun 1.3.14（canary），Linux x64
- sqlite-vec 0.1.9
- 维度 1024（bge-m3 等典型 embedding）
- 向量已 L2 归一化（余弦相似 ↔ 内积）
- top-10，按 notebook_id partition 过滤
- 每档 200 次查询取分位

### 查询延迟（1024-dim，top-10）

| 规模 | 插入耗时 | 插入吞吐 | p50 | p95 | p99 | 带 notebook 过滤 p50 |
|------|------|------|------|------|------|------|
| 1k | 44 ms | 22k rows/s | **1.0 ms** | 1.4 ms | 1.6 ms | 0.3 ms |
| 10k | 355 ms | 28k rows/s | **8.3 ms** | 10.0 ms | 11.6 ms | 3.2 ms |
| 50k | 1.6 s | 31k rows/s | **40.3 ms** | 42.3 ms | 48.8 ms | 14.9 ms |
| 100k | 3.2 s | 31k rows/s | **80.7 ms** | 89.0 ms | 103.9 ms | 29.9 ms |

**观察**：
- 插入吞吐稳定在 **28–31k rows/s**，ingestion 不是瓶颈。
- 查询延迟**近似线性**（暴力扫描特征），符合理论：50k → 100k 翻倍，延迟翻倍。
- **`partition by notebook_id` 收益巨大**：100k 时从 80ms 降到 30ms（~2.7×）。务必用 partition 做多 notebook 隔离。

### 磁盘占用（持久化）

| 维度 | 每 vec | 10k | 50k | 100k |
|------|------|------|------|------|
| **1024**（bge-m3） | 4.1 KB | 40 MB | 198 MB | **397 MB** |
| **1536**（text-embedding-3-small） | 6.2 KB | 61 MB | 297 MB | — |
| **3072**（text-embedding-3-large） | 12.6 KB | 121 MB | — | — |

**观察**：磁盘随维度×规模线性增长。1024-dim 下 10 万 chunk 约 400MB，对桌面 app 可接受（单 `.db` 文件，易于备份/迁移）。

## crystalith 规模估算

基于典型使用假设（PDF ~ 500 字/页 → 1 chunk，平均 50 页/本）：

| 用户类型 | 资料量 | chunk 数 | sqlite-vec p50 | 结论 |
|------|------|------|------|------|
| 轻度 | 10 本 | ~500 | < 1 ms | ✅ 丝滑 |
| 典型 | 100 本 | ~5k | ~4 ms | ✅ 优秀 |
| 重度 | 500 本 | ~25k | ~20 ms | ✅ 良好 |
| 极端 | 2000 本 | ~100k | ~80ms（过滤后 30ms）| ⚠️ 临界，仍可用 |

## 横向对比

| 维度 | sqlite-vec | ChromaDB（现状） | LanceDB | Qdrant |
|------|------|------|------|------|
| 算法 | 暴力扫描（brute-force） | HNSW（ANN） | IVF/LANCE（ANN） | HNSW（ANN） |
| < 10万 规模延迟 | 1–8 ms | ms 级 | ms 级 | ms 级 |
| 百万级延迟 | 几百 ms 起 | ms 级 | ms 级 | ms 级 |
| 部署形态 | **SQLite 扩展，同库** | 独立 server / 嵌入 | native 库 + 文件 | 独立 server |
| bun:sqlite 同库 | ✅ | ❌ | ❌ | ❌ |
| 依赖复杂度 | 极低（1 个 npm 包） | 中（chromadb 进程） | 低 | 中（server） |
| 适合本项目 | ✅✅✅ | 过重 | 备选 | 违背桌面定位 |

**关键判断**：crystalith 是**单用户桌面 app**，资料规模几乎不会超 10 万 chunk。在这个规模下 sqlite-vec 的暴力扫描延迟（< 80ms，过滤后 < 30ms）对"检索→生成"链路完全无感（LLM 推理本身是秒级）。**HNSW 的优势要到百万级才显现，对本项目是过度工程。**

## 何时该换

如果未来出现这些信号，考虑切到 LanceDB（native TS ANN，仍是本地文件）：
- [ ] 单 notebook 超过 50 万 chunk
- [ ] 查询延迟 P99 持续 > 200ms 且影响体验
- [ ] 需要复杂 ANN 索引（IVF/PQ 量化）

切 LanceDB 仍是"本地文件"路线，不破坏桌面 app 定位，迁移成本可控（只换 `shared/vector_storage/` 的 store 实现，上层 `cached.py` 缓存层逻辑不变）。

## 对架构决策的影响

1. **向量库定 sqlite-vec**（确认 [03](./03-ai-ecosystem-mapping.md) 的推荐）。
2. **务必用 `partition by notebook_id`** —— 多 notebook 隔离 + 性能优化一举两得（实测 100k 时快 2.7×）。
3. **embedding 维度选 1024**（bge-m3）为默认平衡点；text-embedding-3-large(3072) 在大库时磁盘翻 3 倍，按需提供。
4. **向后兼容路径清晰**：sqlite-vec → LanceDB，接口层不变。

## 附录：复现脚本

见 [_bench-sqlite-vec/bench.ts](./_bench-sqlite-vec/bench.ts)（延迟测试）、[_bench-sqlite-vec/disk.ts](./_bench-sqlite-vec/disk.ts)（磁盘测试）。

```bash
cd UPGRADES/_bench-sqlite-vec
bun add sqlite-vec
bun run bench.ts   # 延迟
bun run disk.ts    # 磁盘
```

## 相关文档
- [02-target-stack-bun.md](./02-target-stack-bun.md) — Bun 技术栈（sqlite-vec 是其配套）
- [03-ai-ecosystem-mapping.md](./03-ai-ecosystem-mapping.md) — 向量库对照表（本文为 sqlite-vec 的实测背书）
- [05-architecture-and-risks.md](./05-architecture-and-risks.md) — 风险表中"RAG 召回规模"现已验证为可控
