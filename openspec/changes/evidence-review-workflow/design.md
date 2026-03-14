## 背景

如果生成结果开始强调证据、citation 和可引用性，系统就需要一套清楚的审阅工作流，来回答“这个结果是否已被核查”“哪些证据已经看过”“哪里还需要修订”。该能力应该是正式审阅流程，而不是把产品做成重型审批系统。

## 已确定决策

### D1：审阅状态独立于生成成功状态
- 一个结果生成成功，不代表它已经被审阅。
- evidence review 需要自己的状态与转移条件。

### D2：审阅对象围绕结果与证据关系展开
- 审阅不只是对整篇结果打标签。
- 至少需要覆盖结果、citation / evidence 关系和 review note。

### D3：状态转移必须显式
- 审阅状态变化由显式动作触发。
- 本次不引入隐式自动批准语义。

### D4：v1 不做重型审批树
- 本次不扩展到多层审批、组织流或复杂权限会签。
- 重点是把最小可用审阅闭环固定下来。

## 已确定的具体定义

### 最小审阅状态集

| 状态 | 含义 |
|------|------|
| `draft` | 结果生成后的默认状态 |
| `pending_review` | 用户显式点击"开始审阅"后进入 |
| `confirmed` | 所有标记的 citation 均已确认通过 |
| `needs_revision` | 至少一条 citation 被标记为需修订 |

### 状态转移规则

- `draft` → `pending_review`：用户显式点击"开始审阅"
- `pending_review` → `confirmed`：所有标记的 citation 均已确认
- `pending_review` → `needs_revision`：至少一条 citation 被标记为需修订
- `needs_revision` → `pending_review`：用户完成修订后重新提交审阅

### 与质量门的连接

- 质量门的"警告"可以作为建议用户启动 evidence review 的触发提示
- 质量门不强制启动审阅，审阅始终由用户显式发起

### 审阅记录需要引用哪些对象

审阅记录必须能回答“审了什么、审到哪、为什么这么判”，因此至少需要引用：

- **结果对象（Result）**：被审阅的主对象（例如某次生成结果）。
- **citation / evidence 上下文**：结果中的引用项或证据块（用于逐条核查）。
- **来源对象（Source）**：citation 指向的来源对象及其定位信息（片段/位置）。
- （可选）**质量门摘要**：作为“建议启动审阅”的提示来源，但不参与状态裁决。

v1 不要求审阅记录直接绑定到“组织/角色/审批人”，但必须记录操作者身份与时间。

## 审阅对象模型（v1 最小集合）

### EvidenceReview（结果级审阅记录）

```yaml
EvidenceReview:
  id: string
  result_id: string
  status: enum                 # draft | pending_review | confirmed | needs_revision
  created_at: time
  updated_at: time
  started_by: string | null    # user_id
  started_at: time | null
  completed_by: string | null  # user_id
  completed_at: time | null
  items: list[EvidenceReviewItem]
  notes: list[ReviewNote]
```

### EvidenceReviewItem（citation/evidence 级核查项）

```yaml
EvidenceReviewItem:
  citation_id: string
  status: enum                 # unreviewed | confirmed | needs_revision
  last_updated_at: time
  last_updated_by: string | null
  note_ids: list[string] | null
```

### ReviewNote（审阅说明）

```yaml
ReviewNote:
  id: string
  ts: time
  author_id: string
  scope: enum                  # result | citation
  citation_id: string | null
  kind: enum                   # comment | issue | suggestion
  message: string
```

说明：

- “结果级状态”由 items 的聚合决定：存在任一 `needs_revision` → 结果为 `needs_revision`；所有相关 items `confirmed` → 可进入 `confirmed`。
- v1 不要求强制覆盖所有 citations 才能确认，但必须明确“哪些 citations 被纳入审阅”（items 列表即范围）。

## 审阅动作与接口语义（v1）

### 动作集合

- `start_review(result_id)`：创建或打开 EvidenceReview，并将状态置为 `pending_review`。
- `mark_citation_confirmed(review_id, citation_id, note?)`：将该 item 置为 `confirmed`，可附带 note。
- `mark_citation_needs_revision(review_id, citation_id, note)`：将该 item 置为 `needs_revision`，必须附带 note（说明为何需要修订）。
- `add_review_note(review_id, scope, message, citation_id?)`：追加 ReviewNote，不一定改变状态。
- `submit_review(review_id)`：提交审阅并计算结果级状态：
  - 若任一 item 为 `needs_revision` → 结果级状态为 `needs_revision`
  - 若所有 items 为 `confirmed` → 结果级状态为 `confirmed`
- `reopen_after_revision(review_id)`：当用户完成修订后，将 `needs_revision` → `pending_review`，重新进入审阅。

### 幂等与边界

- 所有状态变更必须显式触发，不允许由质量门或生成成功状态隐式推进。
- 对同一 citation 的重复标记应幂等（以最后一次显式动作覆盖，且记录更新时间与操作者）。

## 审阅状态在 API 与结果对象中的呈现方式

- 结果对象应暴露 `evidence_review` 摘要字段，便于列表/详情页展示：

```yaml
evidence_review:
  status: enum
  reviewed_items: int
  needs_revision_items: int
  last_reviewed_at: time | null
```

- 详细审阅内容通过 EvidenceReview 查询接口获取（items + notes + 关联 citation 定位）。

## 工作区入口与协同展示（v1）

### 如何进入 evidence review

- 结果页提供“证据审阅”入口（按钮或 tab）。
- 当质量门返回 warn 且与证据相关（例如 citation_coverage 低）时，UI 仅提示“建议审阅”，不自动进入。

### review note、citation 状态与结果级状态如何协同展示

- 结果级：在结果标题/状态区域展示 `draft/pending_review/confirmed/needs_revision`。
- citation 级：在每条 citation 旁展示其 review item 状态（未审/已确认/需修订）与相关 notes。
- notes：允许在结果级与 citation 级分别记录；citation 级 note 需定位到 citation_id。

## 明确后置：重型审批能力

以下能力明确后置（v1 不承诺）：

- 多角色/多审阅人会签与审批树
- 审阅 SLA、队列与统计看板
- 基于权限的“谁能确认/谁能关闭”的组织策略

### 后置项说明

- D4 中的"多层审批、组织流或复杂权限会签"后置条件：**不确定是否需要，待用户反馈后观察**

## 非目标

- 不构建组织级审批系统。
- 不把质量门直接等同于 evidence review。
- 不在本 change 中引入复杂会签与权限流。
