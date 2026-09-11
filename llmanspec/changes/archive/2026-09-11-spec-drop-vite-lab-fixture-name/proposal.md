---
depends_on: []
rules_edit_acked: true
branch: sdd/spec-drop-vite-lab-fixture-name
base_sha: 57addb1f8485f98070f3a5435feaa73bf03f9110
checkpointed: true
checkpoint_sha: 57addb1f8485f98070f3a5435feaa73bf03f9110
---

# Spec 除名：VITE_LAB_FIXTURE 环境变量引用

## Why（背景与动因）

- `VITE_LAB_FIXTURE` 已于 c103/r456-457（demo Lab 产品化）停止被任何运行时代码读取；
  commit `c22ddae6` 完成 decommission：Zod env SSOT 删除 `@deprecated` 条目、e2e no-op
  剥离/置空移除、`.env.example` 再生后不再出现该变量。
- `deep-research-ui.feature` 两条 `@human` 规则（r400/r453）仍以变量名表述护栏：
  变量已不存在，点名引用会让读者查无此物；约束本质（产品权威 MUST NOT 切换 fixture
  回放）应改为不依赖具体变量名的表述。
- 本变更为**措辞收敛**：MUST/SHALL 语义等价或更强，不改任何行为合约与代码。
  编辑既有 `@human` 规则文本，故 `rules_edit_acked: true`。

## What Changes

- `llmanspec/specs/deep-research-ui/deep-research-ui.feature`：
  - r400（Lab is the only deep-research entry and Eden-only）：「MUST NOT 经
    VITE_LAB_FIXTURE 或 mode=fixture 切换…」→「MUST NOT 切换…（fixture 切换面已废除，
    MUST NOT 重新引入任何 fixture 切换面（含环境变量或查询参数））」
  - r453（Eden Lab production e2e gate）：「在 VITE_LAB_FIXTURE 未设时演练 Eden Lab」
    →「在默认（生产）构建配置下演练 Eden Lab」
- 无应用代码变更；无 wire/HTTP 合约变更。

## Capabilities（影响域）

- `llmanspec/specs/deep-research-ui/deep-research-ui.feature`（仅措辞）

## Impact（影响与边界）

- 对外行为：无变化。变量已不存在，新表述在语义上等价或更强。
- 既有护栏保留：MUST NOT 仅以 fixture 回放 smoke 充当生产 parity 门禁等约束原样保留。

## 测试边界

- `llman sdd validate --specs --strict`（Gherkin + @req 链 + 双写门禁）
- `llman sdd validate --all --strict --no-interactive`
- `llman sdd review` 无 CRITICAL
