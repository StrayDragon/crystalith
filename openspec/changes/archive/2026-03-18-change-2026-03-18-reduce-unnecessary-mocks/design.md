## Context

本变更聚焦后端测试中的 test doubles（`monkeypatch` / stub class / `unittest.mock` 等）使用方式：减少“不必要且脆弱”的 mock，尽可能对齐真实实现与真实 wiring。

现状基线（2026-03-18，来自 `cd backend/py && just test-mock-report`）大致为：
- 测试文件 ~127 个，其中 ~33% 出现 test doubles 技术
- `monkeypatch` 覆盖 ~24%，且存在一些对私有/内部符号的 patch（例如 `_probe_http_endpoint`、`_refresh_optional_services_status`、`_iter_entry_points`、`_load_*`、`_sse_event`）
- hotspot 文件（示例）：`tests/test_plugins.py`、`tests/web/test_api_smoke.py`、`tests/shared/test_extraction_extractors.py`

当前的痛点主要集中在两类场景：
1) **patch 私有符号/内部实现细节**：测试与实现耦合过深，重构成本大、信号不够真实。
2) **缺少稳定 seam**：当代码没有可替换的边界接口时，测试只能 monkeypatch 内部函数来实现“控制外部依赖/观察内部状态”。

我们希望把“控制外部依赖/可观测性”转移到更稳定的 seam（依赖注入、可替换 provider/transport、协议化接口），从而让测试更像真实运行路径。

## Goals / Non-Goals

**Goals:**
- 本变更完成后，将测试中的“私有 patch”（对 `_xxx` 符号/属性的 patch）收敛到 0，并纳入质量门槛强制执行。
- 将 test doubles 使用集中在外部边界：网络、时间、第三方服务、宿主环境变量，而不是内部业务逻辑。
- 提供稳定的 seam，使测试无需 monkeypatch 内部实现细节也能做到可控与可观测。
- 保持测试确定性（不依赖本机服务/网络）与可维护性（减少重复 monkeypatch 样板）。

**Non-Goals:**
- 不追求“零 mock”。对外部边界的替身仍是必要的（例如网络隔离、可选依赖缺失等）。
- 不改变对外 API 语义；本变更属于质量与可维护性改进。
- 不要求一次性重写所有测试；采用分阶段治理 + hotspot 优先。

## Decisions

### 1) 约定：区分“外部边界隔离”与“内部实现替换”

- **允许/鼓励：**
  - 环境变量控制：`monkeypatch.setenv/delenv`（以及集中到共享 fixture）
  - 网络边界：优先使用 `httpx.MockTransport` 或本地 in-process server（必要时可用 stub client，但避免 patch 第三方类）
  - 时间边界：使用可控时钟（如 `freezegun` 或 time provider）
  - 插件/依赖发现：通过显式 provider seam 注入（而非 patch `_iter_entry_points`）
- **强烈避免/逐步消除：**
  - 对私有符号（`_xxx`）的 patch
  - 为了“让测试更容易写”而替换内部逻辑（导致测试不再覆盖真实路径）

### 2) 用 seam 替代私有 patch（按 hotspot 优先）

本变更将优先为以下区域提供 seam，替代现有私有 patch：

#### 2.1 Plugin entry point discovery（替代 `_iter_entry_points` patch）

**现状**：`tests/test_plugins.py` 通过 monkeypatch `crystalith.shared.plugins.registry._iter_entry_points` 固定 entry point 结果，避免依赖宿主环境。
**决策**：将 entry point 发现抽象为可注入 provider（例如 `EntryPointsProvider` / 回调函数），`PluginRegistry.load_from_entry_points(...)` 支持显式传入 provider；同时 `create_app(..., plugins_entry_points_provider=...)` 支持将 provider 透传到启动阶段的插件加载。测试直接传入 stub provider，不再 patch 私有函数。
**备选方案**：
- 继续 monkeypatch `_iter_entry_points`：实现最简单但最脆弱（不选）。
- 用环境变量禁用 discovery：会把测试逻辑“泄露”到运行时语义，且语义不够明确（不选）。

#### 2.2 Optional services probe / refresh（替代 `_probe_http_endpoint` / `_refresh_optional_services_status` patch）

**现状**：`tests/web/test_api_smoke.py` monkeypatch `crystalith.web.app._probe_http_endpoint` / `_refresh_optional_services_status` 来控制 probe/refresh 行为，验证健康检查行为。
**决策**：通过 `create_app(...)` 提供显式 seam，避免测试 patch 私有函数，同时尽量保留对真实逻辑的覆盖：
- `create_app(..., optional_services_refresher=...)`：用于“只验证 refresh 调用次数/缓存语义”的测试，注入 stub refresher（替代 monkeypatch `_refresh_optional_services_status`）
- `create_app(..., http_endpoint_prober=...)`：用于“验证 probe 参数/host 选择/healthy_status_codes”的测试，注入 prober 替身（替代 monkeypatch `_probe_http_endpoint`），而 `_refresh_optional_services_status` 仍走真实逻辑

上述 seam 均提供默认实现（生产环境不需要显式传入）。
**备选方案**：
- 继续 patch 私有函数：脆弱（不选）。
- 通过真实网络探测：会引入外部依赖与 flakiness（不选）。

#### 2.3 Extractor loader（替代 `_load_async_playwright` / `_load_trafilatura` patch）

**现状**：`tests/shared/test_extraction_extractors.py` monkeypatch 内部 loader 来绕过可选依赖与重型初始化。
**决策**：将 extractor 的“依赖加载”拆成显式依赖对象（例如 `BrowserlessExtractorDeps`），构造器支持传入 deps；测试传入 fake deps，生产默认 lazy-load。
**备选方案**：
- 要求安装重型依赖（playwright/trafilatura）跑测试：增加环境成本（不选）。
- 继续 patch 私有 loader：脆弱（不选）。

#### 2.4 事件观测类私有 patch（如 `_sse_event`）

**现状**：个别测试通过 patch `_sse_event` 做“事件到达”观测。
**决策**：不允许“仅用于观测/同步”的私有 patch；一律改为观测真实输出（解析 SSE stream）或通过公开 hook/seam 实现观测。

### 3) 规范化与可观测性：`test-mock-report` 作为迁移导航

- 保留/强化 `just test-mock-report` 作为基线观测工具（支持人类可读与 `--json` 输出）。
- 报告至少覆盖：
  - test doubles 覆盖率（文件级）
  - hotspot（按 test-double score）
  - 私有 patch 目标列表（覆盖 `monkeypatch` + `unittest.mock.patch`/`patch.object` + `mocker.patch`）
  - `Mock reason:` 覆盖情况（用于发现“无理由 patch”）
- 本变更将提供可执行的 gate 命令（例如 `just test-mock-report-check`），并在本变更完成时将其纳入后端默认质量门槛：**私有 patch 目标必须为 0（不允许 allowlist）**。

## Risks / Trade-offs

- [增加 seam 数量] → 通过将 seam 约束在 `internal` 层（模块内 dataclass / Protocol）并在 `design` 中限定适用范围来控制复杂度。
- [测试变得更“集成化”可能变慢] → 优先使用 in-process（ASGITransport、SQLite/内存实现），避免真实网络与外部服务；并保持单测/集成测试边界清晰。
- [过早 gate 可能阻碍迁移] → 本变更先完成私有 patch 清零，再启用严格 gate；gate 启用后不允许 allowlist。

## Migration Plan

1) 固化基线：确保 `just test-mock-report` 输出稳定、可在 CI/本地复现。
2) 按 hotspot 治理私有 patch：
   - plugin entry points → provider seam → 移除 `_iter_entry_points` patch
   - optional services probe/refresh → monitor seam → 移除 `_probe_http_endpoint` / `_refresh_optional_services_status` patch
   - extractor loader → deps seam → 移除 `_load_*` patch
   - 事件观测 patch → 输出观测/公开 hook
3) 收敛规则：新测试不得引入私有 patch；现存私有 patch 必须在迁移中消除或改为 seam。
4) 将 `test-mock-report-check` 纳入后端默认质量门槛（CI 与本地一致），确保私有 patch 目标为 0。
