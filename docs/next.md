Update: Option `explicit` 引用区作为显式输入（只提炼选中引用）

Changes made:
- 引用区支持勾选引用作为显式输入，并在提炼队列中展示“引用 N / 自动检索”：`frontend/web/src/workspace/WorkspacePage.js`, `frontend/web/src/workspace/workspace.css`
- refine API 支持 `chunk_ids`（显式引用输入），覆盖向量检索逻辑：`backend/py/src/crystalith/api/refine.py`
- 前端 `refineBatch` 支持发送 `chunk_ids`：`frontend/web/src/workspace/api.js`
- Ollama embedding provider：当 options 为 None 时不再传入（修复测试与兼容性）：`backend/py/src/crystalith/ai/ollama_provider.py`
- 测试补充/更新：`backend/py/tests/test_refine_output.py`, `frontend/web/src/App.test.js`

Tests:
- `cd backend/py && uv run pytest -q`
- `cd frontend/web && pnpm install`
- `cd frontend/web && CI=true pnpm test`

Notes:
- 当左侧“引用”中存在勾选项时，右侧“加入队列”将仅基于选中引用生成；未勾选时保持原有“按提示词自动检索引用”逻辑。
