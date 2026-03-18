## Why

当前后端测试中存在一定比例的 test doubles（尤其是 `monkeypatch`），并且在少数热点文件里出现了对**私有/内部符号**的 patch（例如 `_probe_http_endpoint`、`_iter_entry_points` 等）。这类“对实现细节的 mock”会带来两个问题：

1) 测试对重构不友好：实现细节一变，测试就需要同步改，导致重构成本被放大。
2) 信号不够真实：patch 过深时，测试容易“通过但不代表真实行为正确”，降低回归可信度。

现状基线（2026-03-18，来自 `cd backend/py && just test-mock-report`）：
- **Before（变更前扫描）**：测试文件 127；Any test double ~33%；`monkeypatch` ops ~130；存在多处私有 patch 目标（`_probe_http_endpoint` / `_refresh_optional_services_status` / `_iter_entry_points` / `_load_*` / `_sse_event`）
- **After（变更完成后）**：测试文件 127；Any test double 41（32.28%）；`monkeypatch` ops 98；**Private patch targets = 0（已纳入 `just test` gate）**

我们希望尽可能让测试对齐真实实现：优先使用 in-process 的真实 wiring（ASGI + SQLite/InMemory 等），仅在真正的外部边界（网络/环境/时间/第三方服务）做隔离，从而减少维护成本并提升回归可信度。

## What Changes

- 建立并落地“减少不必要 mock”的策略与分阶段迁移目标：
  - 定义“必要 vs 不必要”的边界：**禁止/强烈避免** patch 私有符号（`_xxx`）与深层内部实现；鼓励通过显式 seam（依赖注入、可替换 provider/transport）替代。
  - 统一约定：任何改变行为的 patch/替身都必须写明 `Mock reason:`（并尽量复用共享 fixture/测试工具，减少散落的样板代码）。
- 以现有 `test-mock-report` 报告作为基线与迁移导航：
  - 优先处理热点与私有 patch：例如 `tests/test_plugins.py`（`_iter_entry_points`）、`tests/web/test_api_smoke.py`（`_probe_http_endpoint`、`_refresh_optional_services_status`）、`tests/shared/test_extraction_extractors.py`（`_load_async_playwright`、`_load_trafilatura`）等。
  - 目标：将“私有 patch”收敛到 0；将 `monkeypatch` 主要用于环境变量/外部依赖隔离，而不是内部逻辑替换。
  - 本变更完成后，将强制 gate 纳入后端默认质量门槛（`just test`）：**私有 patch 目标必须为 0（不允许 allowlist）**。
- 必要时对生产代码做小幅重构以提供稳定的测试 seam（替代 monkeypatch 内部实现细节）：
  - 插件 entry point 发现 seam（避免 patch `_iter_entry_points`）。
  - optional services probe/refresh seam（避免 patch `_probe_http_endpoint` / `_refresh_optional_services_status`）。
  - extractor loader seam（避免 patch `_load_*` 类内部加载函数）。
  - SSE 观测类测试改为解析真实 stream 输出（避免 patch `_sse_event`）。
- Non-goals：
  - 不追求“零 mock”，外部边界（网络/时间/第三方服务）仍允许使用替身以保证确定性。
  - 不改变对外 API 行为；本变更聚焦测试可靠性与可维护性。

## Capabilities

### New Capabilities
- `test-doubles-and-mocking`: 定义仓库级 test doubles 使用规范（何时使用真实实现、何时允许替身、哪些模式视为不必要 mock），并提供可执行的迁移准则。
- `test-double-usage-reporting`: 提供可复现的 test doubles 使用报告（覆盖率/热点/私有 patch 检测），用于指导重构并防止倒退。

### Modified Capabilities
- `quality-and-regression`: 扩展工程质量基线，使“测试尽量对齐真实实现、避免 brittle mocks”成为可验证的质量约束的一部分。

## Impact

- 影响后端测试：`backend/py/tests/**` 将逐步减少对内部实现的 patch，更多使用真实 wiring 与显式 seam；共享 fixture/测试工具会增加，以减少重复 monkeypatch 样板。
- 影响后端实现：`backend/py/src/crystalith/**` 可能需要引入少量可注入 seam（plugin discovery / probe / extractor loader）以降低测试对内部细节的耦合。
- 影响工具链：`just test-mock-report` 将作为日常可用的可观测性工具；是否进入 CI gate 以及阈值策略在 `design.md` 中确定。

## Verification (2026-03-18)

- Backend: `cd backend/py && just test` ✅（coverage: 85.28%；private patch targets: none）
- OpenSpec: `openspec validate --type change change-2026-03-18-reduce-unnecessary-mocks --strict --no-interactive` ✅
