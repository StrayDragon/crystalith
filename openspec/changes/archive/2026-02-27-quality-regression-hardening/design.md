## Context

CI 已覆盖测试、构建、schema/codegen 漂移与 compose 冒烟，但缺少：
- Python 侧 lint/format 的统一约束（避免风格与潜在 bug 模式漂移）。
- 前端 lint 的 gate（TypeScript strict 不覆盖所有问题）。
- 对关键 API 语义契约的稳定断言（contract tests）。

## Goals / Non-Goals

**Goals:**
- 建立“可持续”的静态质量门槛：从增量开始，不进行大规模无关重写。
- 让本地与 CI 的默认入口一致且可一键运行（减少“只在 CI 才爆”）。
- 引入 contract tests 覆盖关键路径的语义稳定性。

**Non-Goals:**
- 不强制一次性全仓格式化或统一风格（遵守“避免无关 reformat”）。
- 不引入重量级端到端测试框架（优先 pytest/vitest 的 contract 与集成测试）。

## Decisions

- **增量 lint 策略**：
  - 初期 lint 仅对新改动文件严格（或以 baseline/ignore 列表过渡）。
  - CI 先以 non-blocking 或“仅 error 级别 blocking”启动，再逐步收紧。
- **Contract tests**：后端用 pytest 断言关键端点的响应字段与错误信封；前端用 MSW/RTL 验证关键交互不依赖隐式行为。
- **统一入口**：提供 `just check`/`just test` 的补充子任务（例如 `just lint`、`just contract`），并在 docs/贡献指南中写清。

## Risks / Trade-offs

- [lint 引入初期会带来噪声与阻力] → 采用增量策略与清晰的 ignore/baseline 机制；优先抓“高价值问题”规则集。
- [contract tests 维护成本] → 只覆盖“高价值且稳定”的端点与字段；对易变字段采用宽松断言。

## Migration Plan

- 先引入配置与本地入口，再逐步加 CI gate。
- 每个版本/里程碑清理一部分 baseline，避免一次性大修。
