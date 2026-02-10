## ADDED Requirements

### Requirement: Feature API decomposition via sub-routers
系统 SHALL 允许在不改变 `crystalith/features/<feature>/api.py` 作为对外入口的前提下，将该 feature 的端点按职责拆分到同目录下的子模块（例如 `api_tags.py`、`api_ingest.py`），并由 `api.py` 统一聚合导出单一 router。

#### Scenario: 拆分端点但保持入口稳定
- **WHEN** 某个 feature 的 API 端点按职责拆分到多个 `api_*.py` 子模块
- **THEN** `crystalith/web` 只需要继续导入 `crystalith/features/<feature>/api.py`
- **AND** 该 feature 的路由仍以同一个 router 前缀对外提供服务

### Requirement: Import hygiene for API modules
系统 MUST 保持 API 模块的 import 结构清晰：所有 import 语句 MUST 位于模块顶部，并且在任何运行时语句（如 logger 初始化、常量计算、router 声明）之前执行，避免产生隐式的加载顺序问题。

#### Scenario: API 模块加载顺序可预测
- **WHEN** Python 导入 `crystalith/features/<feature>/api.py`
- **THEN** 模块首先完成所有 import
- **AND** 之后才执行 logger/router 等运行时初始化代码
