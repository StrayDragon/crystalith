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

### 建议 vs 自动处理

- v1 大多数治理动作为 **建议**，用户确认后执行
- **自动处理场景**（v1 支持）：
  - connector sync_check 检测到 `source_updated` 时，自动标记 freshness 信号（不自动 re-ingest，但自动标记）
  - 完全相同内容（exact duplicate）的自动提示（staleness_score = 1.0 时自动高亮）
- 执行动作使用 background-jobs-and-task-runtime 的 Job 模型
- 非 exact 的重复处理和批量清理保持为手动确认

### 后置项说明

- D4 中的"批量整理、删除或重命名"后置条件：**待自动标记功能验证后评估，属于"确认需要但延迟"类型**

## 非目标

- 不自动接管用户知识库整理。
- 不在本 change 中自动合并重复内容。
- 不把 freshness 与内容真实性、质量审阅混为一谈。
