## 背景

当外部来源开始稳定接入后，系统很快会遇到第二层问题：哪些来源已经过时、哪些内容高度重复、哪些对象值得重新导入或重新嵌入。这个 change 的目标不是自动整理用户知识库，而是提供稳定的治理信号与维护建议。

## 已确定决策

### D1：freshness 是治理信号，不等于内容真伪判断
- freshness 只回答“是否可能过旧或需要复查”。
- 本次不把 freshness 写成真实性裁判。

### D2：重复检测先提供候选，不自动合并
- 系统先输出 duplicate 候选和建议动作。
- 是否合并、重导入或忽略，保留为用户决策。

### D3：维护建议必须建立在稳定来源对象上
- freshness、duplicate、maintenance suggestion 都建立在接入后的来源对象之上。
- 不在来源对象边界未稳时抢先定义更高层治理动作。

### D4：治理能力不接管整理行为
- 系统提供提醒、候选与建议。
- 本次不自动执行批量整理、删除或重命名。

## 已确定的具体定义

### Freshness 对象模型

```yaml
FreshnessSignal:
  source_id: string
  last_ingested_at: datetime
  source_modified_at: datetime | null   # 来自 connector sync_check
  staleness_score: float                # 0.0 (fresh) ~ 1.0 (stale)
  staleness_reason: enum                # time_decay | source_updated | manual_flag
  suggested_action: enum                # none | re_ingest | re_embed | review

DuplicateCandidate:
  source_a_id: string
  source_b_id: string
  similarity_score: float
  overlap_type: enum                    # exact | near_duplicate | partial_overlap
  suggested_action: enum                # merge | ignore | review
```

### 治理信号与来源对象的关系（source-scoped）

- Freshness/duplicate/maintenance suggestion 都是 **source-scoped** 信号：它们绑定到“已接入后的来源对象（source）”，而不是绑定到某次临时导入请求。
- 信号依赖来源对象的稳定主键 `source_id` 与其可追溯的接入链路信息（例如来自哪个 binding / 路径）。
- 同一外部条目（例如 vault 的某个 `relative_path`）在不同 notebook 中被导入，形成不同的 `source_id`，其治理信号也各自独立（避免跨 notebook 自动串联）。

建议的来源对象最小字段（用于解释 freshness/duplicate）：

```yaml
Source:
  id: string
  notebook_id: string
  origin:
    kind: enum                  # upload | url | connector
    connector_binding_id: string | null
    relative_path: string | null
  last_ingested_at: datetime
  last_embedded_at: datetime | null
  content_fingerprint: string | null    # 可选：hash/签名，用于 exact duplicate
```

- `source_modified_at`（若可用）来自 connector 的 `sync_check` 或 snapshot 条目；上传/URL 场景可为空。
- `content_fingerprint` 仅用于“完全相同内容”的提示；非 exact 重复依赖 embedding/相似度算法，属于候选。

### freshness 与 correctness / review 的边界

- **freshness**：回答“这个来源是否可能过旧/已变化/值得复查”，强调时间与变化，不裁决真假与结论正确性。
- **correctness**：回答“内容是否正确”，属于更高成本的验证维度；v1 不在本 change 中提供自动 correctness 判定。
- **review（审阅）**：属于显式工作流（例如 evidence-review-workflow）；freshness 的 `suggested_action=review` 只意味着“建议审阅/复核”，不等于系统已判定错误。
- 质量门（quality-gates）与 freshness 的关系：质量门是“本次结果的结构化质量信号”；freshness 是“长期来源维护信号”。两者可以共同提示用户，但不互相替代。

### 建议 vs 自动处理

- v1 大多数治理动作为 **建议**，用户确认后执行
- **自动处理场景**（v1 支持）：
  - connector sync_check 检测到 `source_updated` 时，自动标记 freshness 信号（不自动 re-ingest，但自动标记）
  - 完全相同内容（exact duplicate）的自动提示（staleness_score = 1.0 时自动高亮）
- 执行动作使用 background-jobs-and-task-runtime 的 Job 模型
- 非 exact 的重复处理和批量清理保持为手动确认

## 维护动作与接口语义（v1）

本 change 只定义“查看信号 + 显式触发动作”的语义，不把维护变成自动整理系统。

### 查看治理信号

- 在 notebook / workspace 维度提供“治理信号视图”，返回：
  - stale sources（freshness 高）列表
  - duplicate candidates 列表（按 overlap_type 分组）
  - maintenance suggestions（re_ingest / re_embed / review / ignore）

### 确认忽略（ignore）

- ignore 是一种“用户确认不处理”的显式动作：
  - 可对 freshness 建议忽略（例如用户确认该来源虽旧但仍可用）
  - 可对某对 duplicate candidates 忽略（标记为“已审阅/不视为重复”）
- ignore MUST 记录到来源对象的治理状态中，避免反复提示造成告警疲劳。
- ignore 不删除数据、不合并对象；只是改变提示状态。

### 发起重新导入 / 重新嵌入（显式触发）

- `re_ingest`：重新读取来源内容并更新该 source（或产生新版本，具体实现后置）；触发后创建后台 Job。
- `re_embed`：在内容未变或变化不大时，仅重建 embedding；触发后创建后台 Job。
- 对 connector 来源：
  - 当 `sync_check` 指示 underlying 条目变化时，默认建议 `re_ingest`
  - 当仅 embedding 老化（例如模型升级）时，建议 `re_embed`
- 动作执行完成后，系统更新 `last_ingested_at/last_embedded_at`，并重算 freshness 信号。

### duplicate 候选的展示与确认

- exact duplicate：
  - 可在 Sources 列表直接高亮，并提供“查看重复对”入口
- near_duplicate / partial_overlap：
  - 在治理视图中展示候选对 + 相似度 + overlap_type + 建议动作
  - 提供三类显式动作：
    - `review`：打开对比视图（并可引导用户进入证据审阅/内容检查）
    - `ignore`：标记该候选对不再提示
    - `merge`：仅作为建议动作暴露；v1 不自动执行合并，合并流程与冲突处理明确后置

## 产品呈现（v1）

### 工作区如何展示 stale source、重复候选与维护建议

- 在 Sources 管理入口增加“需要维护”视图/过滤器：
  - badge：`Fresh` / `Stale` / `Needs Review`
  - 计数：stale sources 数、duplicate candidates 数
- 在来源详情页展示：
  - freshness 信号（原因 + 建议动作）
  - 最近一次 ingestion/embedding 时间
  - 若来自 connector，展示 `relative_path` 与最近一次 `sync_check` 结果摘要（若有）
- 在治理视图中提供“一键去做”的显式入口（例如“重新导入”“重新嵌入”“忽略”），但所有动作都需要用户确认。

### 复杂治理策略明确后置

以下明确后置（v1 不承诺）：

- 自动合并/自动删除/自动重命名
- 批量清理策略与自动化编排（如“每周自动 re-embed”）
- 跨 notebook 的全局去重与聚类
- 多维健康评分（时间 + 使用频率 + 外部信号）与告警抑制策略

### 明确边界：不演化成自动整理系统

- 系统只提供信号、候选与建议动作；任何会改写用户数据的处理都必须显式触发。
- v1 禁止隐式“自动合并/自动删除/自动接管整理”语义。

### 后置项说明

- D4 中的"批量整理、删除或重命名"后置条件：**待自动标记功能验证后评估，属于"确认需要但延迟"类型**

## 非目标

- 不自动接管用户知识库整理。
- 不在本 change 中自动合并重复内容。
- 不把 freshness 与内容真实性、质量审阅混为一谈。
