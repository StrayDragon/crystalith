## 1. Baseline & Reporting（可观测性 + Gate）

- [x] 1.1 固化 `test-mock-report`：支持人类可读与 `--json` 输出，且输出稳定可复现（排序/字段稳定）
- [x] 1.2 报告输出迁移导航：私有 patch 目标、缺少 `Mock reason:` 的 monkeypatch 使用、hotspots
- [x] 1.3 扩展“私有 patch 目标”检测口径：覆盖 `monkeypatch` + `unittest.mock.patch`/`patch.object` + `mocker.patch`
- [x] 1.4 新增 `just test-mock-report-check`：检测到私有 patch 目标则退出非 0（用于后续强制 gate）
- [x] 1.5 修复当前“使用 monkeypatch 但缺少 `Mock reason:`”的文件（按报告清单逐个补齐注释）

## 2. Seams: Plugin discovery（移除 `_iter_entry_points` 私有 patch）

- [x] 2.1 为 entry point discovery 引入可注入 provider/seam（例如回调/Protocol），默认仍使用 `importlib.metadata.entry_points`
- [x] 2.2 迁移 `tests/test_plugins.py`：使用注入 seam 传入 stub entry points，移除 monkeypatch `_iter_entry_points`
- [x] 2.3 更新 `test-mock-report`：确认该私有 patch 目标从报告中消失

## 3. Seams: Optional services probe/refresh（移除 `_probe_http_endpoint` / `_refresh_optional_services_status` 私有 patch）

- [x] 3.1 为依赖健康检查引入显式 seam：`create_app(..., optional_services_refresher=..., http_endpoint_prober=...)`，默认仍使用真实实现
- [x] 3.2 迁移 `tests/web/test_api_smoke.py`：通过 seam 注入 stub probe/refresh，而非 patch 私有函数

## 4. Seams: Extractor loader（移除 `_load_*` 私有 patch）

- [x] 4.1 为 Browserless/Trafilatura 等可选依赖加载引入显式 deps/seam（构造器可注入 fake deps）
- [x] 4.2 迁移 `tests/shared/test_extraction_extractors.py`：用 deps 注入替代 patch `_load_async_playwright` / `_load_trafilatura`
- [x] 4.3 确保在缺少可选依赖时仍能给出稳定的 `ConfigurationError`（测试覆盖）

## 5. Private patch cleanup（零私有 patch 目标）

- [x] 5.1 迁移/重写仅用于观测/同步的私有 patch（例如 `_sse_event`）：改为解析 SSE 输出或引入公开 hook/seam（不允许私有 patch 例外）
- [x] 5.2 运行 `just test-mock-report`，确认私有 patch 目标清单为空（必须为 0，不允许 allowlist）

## 6. Enable Gate（私有 patch=0 强制门槛）

- [x] 6.1 在私有 patch 清零后，将 `cd backend/py && just test-mock-report-check` 纳入 `cd backend/py && just test` 的默认质量门槛（CI 与本地一致）

## 7. Verification（本地与 CI 一致）

- [x] 7.1 Backend: `cd backend/py && just lint && just typecheck`
- [x] 7.2 Backend: `cd backend/py && just test`（包含 packages-test + guardrails）
- [x] 7.3 Backend: `cd backend/py && just test-mock-report-check`（应返回 0；记录最终报告结果）

## 8. Spec & Closeout

- [x] 8.1 将本变更的增量 specs 同步回 `openspec/specs/`（新增能力 + 修改 `quality-and-regression`）
- [x] 8.2 归档变更到 `openspec/changes/archive/` 并记录最终验证结果
