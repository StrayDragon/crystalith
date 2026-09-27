---
depends_on: ["c115-api-contract-b-class-tests"]
---

# B 区第二批：门禁元规则 + 服务侧（约 30 条）

## Why

B 区按成本推进：本批全部可在 server 侧/仓库元数据上 hermetic 验证，无需前端组件测试基建。quality-and-regression 9 条本质是「门禁组成锁测」（断言 justfile/package.json 的门禁事实）；chat-prompt-presets、generation-core、retrieval-and-cache 沿用 c115 建立的 ai-mock 集成测试与 rag 单测面。

## What Changes

- 新增/扩展测试：quality-and-regression 9（justfile 门禁组成断言）、public-repo-hygiene 3（贡献入口/模板/发布工件元规则）、architecture-core r8（/v2/tasks 退役 404）、chat-prompt-presets 5（empty-query/disabled 400、自定义覆盖、stats 回退）、generation-core 6（tuning 表、knobs 覆盖、requiredPluginId、检索失败传播、[1] 回填、no-evidence reasons）、retrieval-and-cache 6（共享 strategy、distance→similarity、epoch 接线、studio 统一 registry、确定性单嵌入×2）。
- 已覆盖规则在 spec 内补嵌套场景（锚定新测试）；无法 hermetic 验证的保持裸规则并记录。
- 不改产品代码；测试暴露缺陷则报告不动手。

## Capabilities

quality-and-regression、public-repo-hygiene、architecture-core、chat-prompt-presets、generation-core、retrieval-and-cache

## Impact

review `pending` 193 → 约 165（以实际可验证条款数为准）；qa 门禁内新增锁测与集成测试。
