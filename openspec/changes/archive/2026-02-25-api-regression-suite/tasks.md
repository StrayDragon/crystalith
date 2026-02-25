## 1. 后端端点级 smoke tests

- [x] 1.1 新增 `backend/py/tests/web/test_api_smoke.py`，覆盖：
  - `GET /health` → 200
  - `POST /v1/notebooks` → 201（返回 id）
  - `GET /v1/notebooks` → 至少包含新建 notebook
  - `GET /v1/notebooks/{bad_id}/analysis` → 404 + 标准 error envelope
- [x] 1.2 sources smoke flow（不依赖外网）：
  - 上传一个小文本文件到 `POST /v1/notebooks/{id}/sources` → 201
  - `GET /v1/notebooks/{id}/sources` → 包含该 source
  - `GET /v1/notebooks/{id}/sources/{source_id}/chunks` → 返回 chunk 列表（按 index 升序）
  - 删除 source → 204，并回归列表不再包含
- [x] 1.3 错误 envelope contract tests：
  - 422：缺失必填字段/类型不匹配时返回 `error_code="VALIDATION_ERROR"` 且包含 details
  - 400/404：关键端点错误码稳定且 envelope 结构一致

## 2. 可选：outputs/QA 的“无外部依赖”回归

- [x] 2.1 为 outputs/QA 增加最小 contract 测试（若会触发真实 LLM，则在测试中 mock provider/graph 使其纯本地可重复）
- [x] 2.2 至少覆盖：端点存在性、404/400 错误码、done 响应字段形状（不强制验证模型文本质量）

## 3. 运行与 CI

- [x] 3.1 `cd backend/py && just test`
- [x] 3.2 确认 CI 中 smoke tests 默认运行（不需要额外 job）

## 4. 部署后 DevTools 验证清单（手动 smoke）

- [x] 4.1 启动后端：`cd backend/py && uv sync && just dev`
- [x] 4.2 启动前端：`cd frontend/web && pnpm install && pnpm dev`
- [x] 4.3 浏览器 DevTools → Network/Console：
  - 创建 notebook、上传 source、打开 chunks 列表：请求均为 2xx，响应字段形状正常
  - 触发一个确定性 4xx（例如无效 notebook_id 或空文件上传）：状态码为 4xx 且错误响应为标准 envelope（含 `error_code/message`）
  - 打开 Analysis 面板：`/analysis` 返回 200；空 notebook 返回空数组
  - 全程 Console 无未捕获异常

## 验证记录

- 自动化测试：
  - `cd backend/py && just test` → 通过（375 passed，coverage 85.34%）
- CI 默认覆盖确认：
  - `backend/py/justfile` 中 `just test` 执行 `uv run pytest tests/ -v`，`test_api_smoke.py` 位于 `tests/web/`，默认被收集执行。
- 部署后 DevTools 手动 smoke（本地 deterministic 配置）：
  - `CRYSTALITH_CONFIG_PATH=/tmp/crystalith-devtools-config.yaml`
  - 关键请求验证：创建 notebook 201、上传 source 201、sources/chunks 200、missing notebook 404 + envelope、空上传 400 + envelope、空 notebook analysis 200 + 空数组。
