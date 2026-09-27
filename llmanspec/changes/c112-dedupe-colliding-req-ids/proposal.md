---
depends_on: ["c111-convert-pilot-bare-rules"]
---

# 修复 spec 文件内 @req 编号碰撞（45 tag / 54 处）

## Why

历史「重排全局 req id」（f67dc408）遗漏导致 11 个 `.feature` 文件内同一 `@req` 编号挂在多条规则上（45 个碰撞 tag、54 处需重取号；重灾区 deep-research-ui 18、deep-research-runtime 14）。`@req` 是 0.5 句柄系统的唯一键（resolve-req / review 报告 / 锁定报告 / 归档引用），碰撞使句柄歧义，且后续裸规则压降批次要以 `@req` 锚定场景——必须先修。

上游 llman-sdd 0.5.0 的两道防线对本类碰撞均漏报（validate「全局重复 req_id」ERROR 门、`project dedupe-req-ids`），已记录至 docs/specs-bare-rule-campaign.md 待报上游；本 change 同时落地一个本地防回归自检配方兜底。

## What Changes

- **specs 句柄重排**（11 个 capability，规则文本零改动）：每个碰撞 tag **首次出现保留原号**（归档 change 引用继续有效），后续出现按「文件字母序 + 行序」分配全局新号 **r420–r473**（紧接现有最大 r419）。映射全表见 design.md。
- **本地防回归自检**：新增 `scripts/check-req-id-collisions.ts`（扫描 `llmanspec/specs/**` 内同文件多规则行共用 tag）+ `just check-req-ids` 配方。**不加入 `just qa`**（门禁组成 canonical 归属 quality-and-regression；上游修复后可迁移为上游门）。

## Capabilities

architecture-core、chat-prompt-presets、deep-research-runtime、deep-research-ui、workspace-ui-core、typed-generation-framework、output-rendering-and-typing、retrieval-and-cache、source-ingestion-upload-and-url、web-extractor-plugins、workspace-api-contract（各文件的碰撞 tag 清单见 design.md）。

## Impact

- 纯 `@req` 句柄重排：pending 计数不变（448）、validate 结构门不受影响、既有规则的 MUST 文本与嵌套场景零改动。
- 被重号规则在归档 change 文档中的引用本就因碰撞歧义；重排后以新号为准（首现规则引用不受影响）。
- 全仓描述文本对被重号 tag 的交叉引用：已扫描，0 处。
