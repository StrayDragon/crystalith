# 2026-03-21 OpenSpec 活跃提案裁剪记录

## 本次决策

Crystalith 的主旨调整为:

- 个人使用
- 私有优先
- 非商业化

因此, `openspec/changes/` 不再承载默认面向团队、组织、客户交付和商业化运营的 proposal。凡是当前问题定义已经建立在这些前提上的 change, 统一从活跃区移到 `openspec/notplan-changes/`。

本次操作不是删除, 只是下放:

- 备份文件: `../crystalith-openspec-changes-backup-20260321-212528.tar.gz`
- 从活跃区移出的 change 数量: `70`
- 裁剪后仍保留在活跃区的 change 数量: `50`

## 裁剪标准

下列任一命中即移出活跃区:

1. 明确引入多用户身份、成员、审批、角色或 requester / reviewer / admin 语义
2. 明确面向 tenant / organization / region / control plane / operations center
3. 明确面向客户交付、服务目录、SLA、伙伴、白标、marketplace、public launch
4. 明确面向定价、计费、授权、续约、营收预测、商业扩张
5. 虽然能力本身可能有个人版, 但当前 proposal 的 Why / Impact 已经深度绑定以上语境

## 已移出活跃区的 change

### A. 多用户、门户与协作流程

- `c07-identity-and-workspace-access`
- `c08-multiplayer-review-workspace`
- `c09-external-share-portals`
- `c14-approval-flows-and-audit-trails`
- `c56-chatops-notifications-and-interactive-approvals`
- `c64-workspace-branching-and-merge-requests`
- `c67-request-intake-and-service-delivery-workspaces`
- `c68-review-queues-sla-and-work-allocation`

### B. 平台化治理、组织边界与管理员运营

- `c12-tenant-usage-and-billing-controls`
- `c17-admin-observability-and-operations-center`
- `c18-compliance-retention-and-data-governance`
- `c26-embedded-workspaces-and-headless-consumption`
- `c27-policy-packs-and-environment-promotion`
- `c29-cost-intelligence-and-model-routing-governance`
- `c34-private-deployment-and-regional-data-plane`
- `c38-controlled-rollouts-and-experimentation-governance`
- `c39-customer-trust-center-and-audit-export-pack`
- `c72-org-topology-and-delegated-administration`
- `c73-business-units-tenants-and-boundary-governance`
- `c74-federated-regions-and-control-plane-peering`
- `c75-admin-roles-journeys-and-separation-of-duties`
- `c76-environment-topology-and-service-zones`
- `c77-policy-composition-exceptions-and-inheritance`
- `c78-release-rings-freeze-windows-and-change-governance`
- `c79-workspace-lifecycle-provisioning-and-decommissioning`
- `c80-tenant-bootstrap-and-golden-baselines`
- `c81-operator-runbooks-and-execution-guardrails`
- `c82-global-operations-command-center`
- `c83-capacity-queues-and-resource-fairness-control`
- `c84-incident-command-major-events-and-restoration`
- `c85-operations-calendar-shifts-and-handoffs`
- `c86-backlog-burn-down-and-remediation-campaigns`
- `c87-platform-health-score-and-risk-budgets`
- `c88-org-wide-search-audit-and-admin-discovery`
- `c89-control-plane-simulations-and-game-day-drills`
- `c90-predictive-risk-alerting-and-early-warning`
- `c91-guided-remediation-and-operator-copilot`
- `c92-autonomous-maintenance-windows-and-safe-automation`
- `c93-executive-ops-briefings-and-governance-reviews`

### C. 商业化、生态、市场与营收路线

- `c11-connectors-sync-marketplace`
- `c28-extension-sdk-and-solution-marketplace`
- `c30-portfolio-level-agent-programs`
- `c31-domain-blueprints-and-industry-packs`
- `c32-stakeholder-digest-network-and-board-reporting`
- `c54-plugin-signing-and-supply-chain-trust`
- `c62-developer-portal-and-api-explorer`
- `c63-public-launch-and-community-funnel`
- `c94-service-catalog-offers-and-commercial-packaging`
- `c95-entitlements-feature-access-and-contract-enforcement`
- `c96-metering-pricing-and-credit-programs`
- `c97-showback-chargeback-and-billing-operations`
- `c98-subscriptions-commitments-and-renewal-governance`
- `c99-account-health-adoption-and-expansion-signals`
- `c100-customer-success-plans-and-value-delivery-cadences`
- `c101-procurement-security-reviews-and-deal-desk-workflows`
- `c102-partner-delivery-network-and-white-label-operations`
- `c103-marketplace-revenue-share-and-commercial-settlement`
- `c104-solution-certification-and-go-live-readiness`
- `c105-revenue-forecasting-pipeline-and-capacity-planning`
- `c106-commercial-offer-launches-and-bundled-motions`
- `c107-reference-programs-and-proof-of-value-packs`
- `c114-service-lines-and-delivery-pods`
- `c116-adoption-barriers-and-remediation-journeys`
- `c117-solution-migration-accelerators-and-cutover-guides`
- `c118-executive-sponsor-views-and-steering-rhythms`
- `c119-commercial-readiness-and-expansion-playbooks`

### D. 当前语义过度偏向交付/阶段治理, 暂不保留

- `c66-external-actions-and-system-of-record-writebacks`
- `c112-delivery-milestones-and-handoff-packets`
- `c113-workspace-maturity-stages-and-upgrade-paths`
- `c115-proof-of-work-timeline-and-value-recap`

这些能力并非永远无价值, 但当前 proposal 的叙事已经明显偏向外部交付、经营升级或组织化流程。若未来要重新启用, 建议以“个人工作台如何更好沉淀、复盘和回放”为问题重写。

## 保留区的处理说明

保留在 `openspec/changes/` 的 proposal 仍有少量旧交叉引用, 例如引用已被下放的 change 编号。这次只做路线裁剪和优先级重排, 没有逐个重写所有 proposal 文案。

后续建议:

1. 下一轮继续清理保留提案里的旧依赖和旧企业化措辞
2. 新 proposal 一律先写单人私有场景, 不再预埋多人和商业化扩展位
3. 若未来真的要做多人或商业化, 另开独立 change, 不反向污染当前主线
