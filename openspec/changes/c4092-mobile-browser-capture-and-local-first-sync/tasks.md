## 1. Capture envelope and entrypoints

- [ ] 1.1 定义 mobile capture、browser clipper、URL quick import 的统一 capture envelope
- [ ] 1.2 定义 capture metadata、cleaning profile 与延后落地语义
- [ ] 1.3 定义轻入口如何进入 source / draft / review 正式链路

## 2. Local-first queue and sync

- [ ] 2.1 定义统一 local draft queue 与对象映射边界
- [ ] 2.2 定义 sync preflight 的结果分类、冲突摘要与 replay contract
- [ ] 2.3 定义 block/object 粒度冲突检测、自动合并与人工决议边界

## 3. UI and API integration

- [ ] 3.1 定义 mobile/small-screen 下的 capture/sync 状态入口
- [ ] 3.2 定义 capture ingest、preflight、conflict summary 和 queue replay API 语义
- [ ] 3.3 复核 mobile/browser/Notebook 三类入口共用同一 local-first 模型且没有平行缓存真相

## 4. Verification

- [ ] 4.1 复核 merged proposal 已吸收 `c2013`、`c2031`、`c2073`、`c4018` 的核心约束
- [ ] 4.2 复核 capture、queue、preflight、conflict resolution 语义互相支撑
- [ ] 4.3 运行 `openspec validate c4092-mobile-browser-capture-and-local-first-sync`
