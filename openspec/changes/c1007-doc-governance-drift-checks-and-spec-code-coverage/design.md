## Context

随着 specs/changes/docs/生成产物/注入块越来越多，“看起来都对但其实漂了”的概率会快速上升。只靠约定无法稳定维护一致性：需要把 drift checks 变成可复用门禁，并且把 CI 的结果变成可消费信号（能定位、能复现、能知道下一步该跑什么）。

本 change 将两件事合并推进：

1) doc/spec/code 的一致性与覆盖关系可见化（link index + coverage map）
2) 把 drift checks + CI baseline 固化成稳定门禁（required checks + 可定位失败输出）

## Goals / Non-Goals

- Goals:
  - drift checks 收口到一组稳定入口：docs drift、doc governance、openspec validate、OpenAPI/client drift、config schema drift、import layering 等
  - CI 基线明确：后端 lint/typecheck/tests/contract；前端 test/lint/format/typecheck/build；API/client sync check
  - CI 产出可消费信号：覆盖率 artifact/摘要、依赖漏洞扫描结果
  - required checks / branch protection 的落地说明与建议（避免“只存在于口头”）
  - spec ↔ code ↔ tests link index + coverage map 的最小实现（先可见，再约束）
- Non-Goals:
  - 不在本 change 中一次性实现完整文档站点信息架构重构
  - 不把覆盖率做成机械 KPI（覆盖率只是信号，不是唯一门禁）
  - 不强制绑定某一种安全扫描供应商（只要求可复现与可消费输出）

## Decisions

- CI baseline SHOULD 尽量复用仓库已有稳定入口（例如 `just`/`pnpm run`），避免在 workflow 里复制大量脚本逻辑。
- Drift failures 的输出 MUST 指向“下一步该跑的命令”，而不是只给 diff。
- 对 branch protection 的要求以“建议 + 文档”落地；实际配置由仓库管理员在平台侧完成。
