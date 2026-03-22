## Why

Notebook-centric 的产品走到后面，最容易变成两种痛：空间越来越大、问题越来越难复现。数据库、向量库、生成产物、缓存、临时文件……任何一个增长点没被看见，最后都会在“清理”或“迁移”时集中爆雷。

与其等到用户说“怎么突然占了 30GB”，不如提前把维护工具做成可预览、可回滚、可解释的常规动作。

## What Changes

- 提供可观测的“存储体检”：
  - footprint breakdown（DB / vector store / artifacts / cache / attachments）
  - heavy objects/top N（按 notebook/source/run 维度都能看）
- 提供可预览的维护动作（先预览再执行）：
  - DB vacuum/compaction（SQLite/PG 语义分别说明）
  - 向量库 compaction（如果 provider 支持）
  - 生成产物与临时文件清理（与 `just cleanup` 对齐）
- 提供保留策略（retention policy）：
  - 对 run/event/repro pack 的保留规则（按时间、按数量、按大小）
  - 支持“预览删除清单”，避免误删
- 缓存可视化与失效策略：
  - cache epoch 查看/重置的可解释入口
  - key 数量与命中率的最小指标（引用 `c12`）

## Capabilities

### New Capabilities

- `maintenance-tooling`: 体检视图、预览式清理、保留策略与缓存治理的契约。

### Modified Capabilities

- `data-and-storage`: 存储结构、保留策略与 compaction 的边界要求。
- `retrieval-and-cache`: cache epoch 与失效策略的可解释性要求。
- `delivery-and-deployment`: `just cleanup`/维护命令的入口、默认策略与安全护栏。

## Impact

- Backend：需要提供 footprint/预览接口与执行入口（可先做 CLI，再做 UI）。
- Frontend：一个“维护”面板就能承接大部分用户反馈（慢、占空间、清不动）。
- Dependencies：建议与 `c31` 的 DB hygiene 一起讨论，避免维护工具绕开迁移/约束。

## Dependency Sketch

```mermaid
flowchart TD
  INSPECT[Inspect footprint] --> PREVIEW[Preview actions]
  PREVIEW --> APPLY[Apply maintenance]
  APPLY --> VERIFY[Verify invariants]
  VERIFY --> REPORT[Report + next steps]
  APPLY --> ROLLBACK[Rollback boundary (if supported)]
```
