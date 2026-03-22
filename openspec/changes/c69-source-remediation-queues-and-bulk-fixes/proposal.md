## Why

`c03` 会告诉我们来源哪里不健康，但当来源开始成百上千时，"知道有问题"和"真的修得动"是两回事。解析失败、授权失效、元数据缺口、重复来源、敏感信息命中，如果没有批量修复层，来源治理最后很容易变成慢性积压。

## What Changes

- 增加 remediation queue，把来源异常按可执行动作收口，例如重试提取、重新绑定、补标签、隔离、归档或批量重抓。
- 支持按 connector、owner、异常类型、敏感等级和影响范围筛选待修复项，而不是回到来源列表逐个点。
- 为常见异常提供 bulk fix preview，先看影响，再确认执行，避免一键批量把库改坏。
- 让来源治理结果回写 freshness、搜索可见性、review 风险和权限限制，而不是停在单一面板里。
- 把这条线和 `c03` 区分开来: `c03` 偏可见性与状态，`c69` 偏运营修复与批处理动作。

## Capabilities

### New Capabilities

- `source-remediation-and-bulk-fixes`: 定义来源修复队列、批处理预览、执行回执和修复结果语义。

### Modified Capabilities

- `source-readiness-and-freshness`: 需要支持把 readiness 异常转成正式 remediation item。
- `source-connectors`: 需要暴露可重试、可重绑、可同步和不可恢复异常的稳定动作面。
- `workspace-metadata-tags-and-discovery`: 需要支持修复前后标签、归类和发现性的联动变化。
- `dlp-redaction-and-sensitive-data-guards`: 需要把敏感命中来源接入隔离和修复工作流，而不是只给告警。
- `admin-observability-and-operations-center`: 需要提供来源运营健康、修复吞吐和积压概览。

## Impact

- Backend：需要新增 remediation item、bulk action planner、preview engine 和 execution receipt。
- Frontend/Admin：需要补来源修复队列、批量操作预览、风险提示和执行历史。
- Product：这条线更偏运营面，但一旦来源规模上来，它比新增一个连接器更值钱。
- Dependencies：建议接在 `c03-source-readiness-and-freshness-hub`、`c11-connectors-sync-marketplace`、`c42-workspace-metadata-tags-and-discovery`、`c55-dlp-redaction-and-sensitive-data-guards`、`c17-admin-observability-and-operations-center` 之后。

## Dependency Sketch

```mermaid
flowchart TD
  C03[c03 来源健康中心]
  C11[c11 连接器市场]
  C42[c42 元数据标签发现]
  C55[c55 DLP 与敏感数据防护]
  C17[c17 管理员运营中心]
  C69[c69 来源修复与批处理]

  C03 --> C69
  C11 --> C69
  C42 --> C69
  C55 --> C69
  C17 --> C69
```
