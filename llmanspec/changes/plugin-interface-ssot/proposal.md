---
depends_on: []
branch:
base_sha: null
checkpointed: false
---

# Proposal — Plugin Interface SSOT（DRAFT，c13 触发前不实施）

> 状态：**草案**。本提案在 c13（分发/插件宿主）解锁前保持 parked；
> 解锁后经 propose 正式化（补 design/tasks + Branch binding）再实施。

## Why

v2 无插件宿主：studio slides config 表以「内置表」形式存在
（apps/server/src/features/studio/config.ts 头注释已注明 c13 relocate 意图），
extractor 以内置注册表存在（shared/extraction/factory.ts）。
一旦 c13 决定支持外部插件（pip-install 式或 npm 式），需要先有一个
Plugin 接口 SSOT，避免各域自造插件形状。

## What Changes（方向性，待 c13 细化）

- 定义 `CrystalithPlugin` 接口 SSOT：id / kind（output-type | extractor | parser |
  slidev-theme）/ configSchema（Zod）/ factory 入口 / 能力声明
- studio config 表与 extractor factory 迁移为该接口的两个内置实现（行为不变）
- `/v2/workspace/tools` 的 diagnostics.official catalog 由接口清单驱动
  （workspace-api-contract r18 已预留该形态）
- 分发载体随 c13 决策：npm 包 vs 单二进制内嵌

## 非目标

- 不引入动态代码加载的热插拔；首版仅支持编译期内置插件集合
- 不改变任何现有 wire 行为

## 触发条件

c13 解锁且产品确认需要第三方/可选插件分发时。
