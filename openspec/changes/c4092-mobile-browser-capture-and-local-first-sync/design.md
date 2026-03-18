## Context

移动端采集、浏览器 clipper、Notebook 编辑和轻量审阅都在争夺同一个产品位置：用户不一定在线，也不一定坐在桌面前，但仍然想把信息先抓住、先改掉、先确认，再在合适时机同步。如果这些入口不共享一套本地缓存、预检和冲突模型，系统会很快出现“每个入口都能离线一点，但彼此不兼容”的状态。

本合并变更把这几条线收口为一个 local-first capture and sync substrate。capture 入口只负责采集与最小整理，真正的同步、冲突判定和决议规则由统一 queue / preflight / sync model 负责。

## Goals / Non-Goals

**Goals:**

- 定义 mobile 与 browser capture 的统一对象语义
- 定义 local-first draft queue 作为所有待同步对象的唯一缓冲层
- 定义 sync preflight 与 block-level conflict resolution，避免静默覆盖
- 定义轻入口采集如何落入正式 source / notebook / review 流程

**Non-Goals:**

- 不在本变更中展开组织级多端权限/设备管理策略
- 不在本变更中定义完整浏览器扩展 UI 细节或移动视觉稿
- 不在本变更中包含 backup/migration/archive 的长期存储治理

## Decisions

### 1. 轻入口统一产出 capture envelope，而不是各入口自定义 payload

- mobile share、browser clipper、URL quick import、selection capture 和 screenshot capture 都先归一成统一 capture envelope
- envelope 至少包含 source locator、capture mode、capture timestamp、origin surface、可选 cleaning profile 与最小 provenance 摘要
- 后端 ingest 与本地 draft queue 都以该 envelope 为基础，而不是识别多套不同入口格式

### 2. local draft queue 是唯一待同步缓冲层

- 所有离线新增、修改、待确认和待同步对象都进入同一 draft queue
- queue 既服务 Notebook block 编辑，也服务 capture drafts、review actions 和轻量来源补录
- 不保留“扩展本地缓存”“移动端暂存箱”“编辑器待提交状态”三套长期并行机制

备选方案是每个入口维护自己的 pending state，再在服务端尝试归并。该方案会导致冲突判定和恢复提示无法一致，因此不采用。

### 3. sync preflight 先给出结果分类，再决定是否真正 flush

- queue flush 前必须执行 sync preflight
- preflight 统一输出 `silent_sync`、`confirm_required`、`blocked`
- 预检报告至少包含冲突风险、依赖缺口、对象缺失、潜在覆盖与建议恢复动作

### 4. 冲突以 block/object 粒度分类，必要时进入人工决议

- Notebook 编辑冲突落到 block 粒度
- capture metadata、review actions 和 source draft 以对象粒度冲突
- 系统必须区分“可自动合并”“需要用户确认”“必须人工决议”，而不是一律最后写入覆盖

### 5. capture ingest 与正式 source pipeline 解耦，但保持可追溯

- capture 可以先进入 draft / inbox / notebook pending lane，不强迫用户当场完成全部整理
- 一旦确认落地到正式 source，系统仍保留 capture metadata 与最小 provenance
- reader cleaning / normalization 作为 capture metadata 的一部分被记录，并允许导入后重跑

## Risks / Trade-offs

- [统一 queue 过于抽象，导致简单 capture 也显得重] → 通过 silent sync 路径让低风险快速落地，复杂度只在需要时暴露
- [block 级冲突过多，打断编辑体验] → 明确 auto-merge 条件，只把高风险冲突升级为人工决议
- [扩展端与移动端实现差异较大] → 统一 capture envelope 和 preflight contract，把平台差异限制在壳层
- [reader cleaning profile 与 sync 逻辑耦合] → cleaning profile 只作为 capture metadata 输入，sync model 不承担正文清洗逻辑

## Migration Plan

1. 先定义 capture envelope、draft queue 和 preflight contract
2. 将 mobile/browser/Notebook 轻入口全部改为写入统一 queue
3. 接入统一 sync cursor、conflict summary 和 replay API
4. 移除分散的旧式 pending state / 临时缓存入口

回滚边界：若统一 queue / preflight contract 在实现阶段无法覆盖核心 capture flow，可回滚整个 change，不保留入口级临时分叉模型。

## Open Questions

- mobile 与 browser 是否都需要完整 conflict resolution UI，还是部分高风险场景跳转到桌面决议
- capture screenshot 的 OCR/annotation 是否属于同一 queue contract，还是后续再扩展
