---
depends_on: []
branch: sdd/specs-compact-2026-08
base_sha: 5d0517cb128b657cc570d759eb57075569afd298
checkpointed: false
---

## Why

37 个 capability / 420 requirements 的全量审计（2026-08）发现：约 40+ 条 requirement 违反
`llmanspec/AGENTS.md`「Spec 书写守则」（代码路径/函数名/魔法数字/v1 引用/迁移期叙事入 MUST）、
2 条 requirement 正文在 TOON 序列化中被截断、1 对跨 spec 默认值矛盾、17 组跨 capability 冗余。
按 llman-sdd-specs-compact 维护流程压缩，保持全部规范行为可验证。

## What Changes

- 修复 2 条截断 requirement（workspace-api-contract r18 / web-extractor-plugins r185）
- 消除 deep-research-ui r401 与 deep-research-runtime r304 的默认值表述矛盾
- 守则违规改写：魔法数字归 config schema；去函数名/文件路径锚定；v1 引用与迁移叙事合并为当前态单一声明
- 冗余合并（keep/merge/remove 见 tasks.md）：capability 37 → 33，requirements 约 −8%
- 不改变任何规范行为；`llman sdd validate --specs --strict` 必须全绿
