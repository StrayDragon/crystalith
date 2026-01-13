Update: Option `explicit` 引用区作为显式输入（只提炼选中引用）

Changes made:
- Manual提炼队列与卡片式提示词输入（含预设模板、队列列表、输出选择）：`frontend/web/react-flow-demo/src/workspace/WorkspacePage.js`, `frontend/web/react-flow-demo/src/workspace/workspace.css`
- 右侧提炼卡片文案/模板默认值确认，提示词库扩展：`frontend/web/src/workspace/WorkspacePage.js`, `frontend/web/src/workspace/workspace.css`
- 引用区支持勾选引用作为显式输入，并在提炼队列中展示“引用 N / 自动检索”：`frontend/web/src/workspace/WorkspacePage.js`, `frontend/web/src/workspace/workspace.css`
- refine API 支持 `chunk_ids`（显式引用输入），覆盖向量检索逻辑：`backend/py/src/crystalith/api/refine.py`
- 前端 `refineBatch` 支持发送 `chunk_ids`：`frontend/web/src/workspace/api.js`
- Ollama embedding provider：当 options 为 None 时不再传入（修复测试与兼容性）：`backend/py/src/crystalith/ai/ollama_provider.py`
- SQLite锁冲突缓解（WAL + busy_timeout + connect timeout）：`backend/py/src/crystalith/db/manager.py`
- pnpm ESLint 兼容（hoist规则）：`frontend/web/react-flow-demo/.npmrc`
- 忽略本地数据文件：`.gitignore`
- OpenSpec 更新为“手动提炼 + 队列 + 自定义提示词”：`openspec/changes/add-research-workspace/specs/refine-output/spec.md`, `openspec/changes/add-research-workspace/specs/workspace-ui/spec.md`, `openspec/changes/add-research-workspace/proposal.md`, `openspec/changes/add-research-workspace/tasks.md`
- 说明补充：`README.md`
- 测试补充/更新：`backend/py/tests/test_refine_output.py`, `frontend/web/src/App.test.js`

Tests:
- `cd backend/py && uv run pytest`
- `pnpm -C frontend/web install`
- `CI=true pnpm -C frontend/web test`

Notes:
- 右侧提炼不再自动生成，改为“加入队列”触发；生成结果按队列任务展示与切换。
- pnpm 启动已不再报 ESLint plugin 冲突（通过 `.npmrc` hoist 解决）。
- 当左侧“引用”中存在勾选项时，右侧“加入队列”将仅基于选中引用生成；未勾选时保持原有“按提示词自动检索引用”逻辑。
- 修复队列首个任务需二次加入才启动的问题（加入队列后即触发执行）。

Next steps (pick one):
1) 我帮你再跑一遍前后端联调，回归“队列首任务 + 显式引用输入”全流程  
2) 如果要把引用选择做成默认模式（或增加快捷按钮），我继续优化交互  
3) 需要更复杂的提示词库（分组/收藏/最近使用）的话，我再细化交互
