## Why

后端当前端点级回归覆盖较薄（主要集中在 lifespan/CORS），多数核心业务 API（sources ingest、sessions/messages、outputs、QA、analysis、research 等）缺少稳定的集成回归测试。这会导致：

- 小改动容易引入端点行为回归但不被及时发现
- 错误 envelope、状态码与跨端契约更容易漂移

需要补齐一套“端点级回归测试 + 部署后 DevTools 验证清单”，覆盖关键用户路径的最小闭环。

## What Changes

- 新增/扩展后端集成测试：以 notebook 为隔离单元跑通关键 API 流程（创建 notebook → 上传/URL 导入 source → QA → outputs → analysis → 删除/清理）。
- 对关键错误场景增加断言：404/400/422 的 status code 与标准 error envelope 结构。
- 增加部署后手动验证套件（DevTools）：提供一份可重复执行的 Network/Console 检查清单与可选 curl 命令。

## Capabilities

### New Capabilities
- `api-regression-suite`: 定义端点级回归测试覆盖范围、最小 smoke flows、以及部署后 DevTools 验证步骤。

### Modified Capabilities
- （无）

## Impact

- 受影响代码（预计）：
  - `backend/py/tests/web/*`（新增更多端点级测试）
  - 可能新增测试 helpers/fixtures（创建 notebook、上传文件、SSE 读取等）
- CI 影响：
  - pytest 时间略有增加，但可通过只覆盖最小 smoke flows 控制增量
