---
depends_on: ['c113-add-a-class-scenarios']
branch: sdd/c114-deep-research-a-class-scenarios
base_branch: main
base_sha: 8c6da12cdb591c436c474d0caab77e16bf42bc26
---

# 深研双雄 A 类裸规则补场景（deep-research-ui 65 + deep-research-runtime 56）

## Why

作战地图最大两块：deep-research-ui（76 裸规则）与 deep-research-runtime（63 裸规则）。盘点判定其中 A 类 121 条（行为可程序判定、锚点落在 apps/web/src/features/research-lab/_.test 与 apps/server/tests/research/_ 等既有资产），B 12 条、C 6 条。碰撞句柄已经 c112 清零，可安全以规则标题定位补场景。

## What Changes

- 两个 feature 文件的 A 类裸规则（共 121 条）各补 1 个嵌套 `场景:`（结构化 GWT，house style 同 c111/c113）。
- B 类（12 条）与 C 类（6 条）保持裸规则，理由汇入作战地图台账。
- 规则描述文本零改动，不新增测试代码。

## Capabilities

- `specs/deep-research-ui`
- `specs/deep-research-runtime`

## Impact

review `pending` 预期 330 → 209；此后全仓仅剩 B 159（需新增测试资产，独立批次）与 C 47（有据豁免）。
