Used `ui-ux-pro-max` to guide the new right‑panel layout (card + queue) and visual treatment.

Right panel now matches NotebookLM’s “manual generation” flow: a提炼卡片 with editable提示词 + presets, a visible生成队列, and outputs only after clicking“加入队列”. Chat no longer auto‑triggers提炼. I also hardened SQLite locking, added pnpm ESLint hoisting, and ignored local data artifacts.

Changes made:
- Manual提炼队列与卡片式提示词输入（含预设模板、队列列表、输出选择）：`frontend/web/react-flow-demo/src/workspace/WorkspacePage.js`, `frontend/web/react-flow-demo/src/workspace/workspace.css`
- SQLite锁冲突缓解（WAL + busy_timeout + connect timeout）：`backend/py/src/crystalith/db/manager.py`
- pnpm ESLint 兼容（hoist规则）：`frontend/web/react-flow-demo/.npmrc`
- 忽略本地数据文件：`.gitignore`
- OpenSpec 更新为“手动提炼 + 队列 + 自定义提示词”：`openspec/changes/add-research-workspace/specs/refine-output/spec.md`, `openspec/changes/add-research-workspace/specs/workspace-ui/spec.md`, `openspec/changes/add-research-workspace/proposal.md`, `openspec/changes/add-research-workspace/tasks.md`
- 说明补充：`README.md`

Tests:
- `openspec validate add-research-workspace --strict`
- `pnpm install`
- `pnpm start` (compiled; backend未启时出现正常的 proxy ECONNREFUSED)

Notes:
- 右侧提炼不再自动生成，改为“加入队列”触发；生成结果按队列任务展示与切换。
- pnpm 启动已不再报 ESLint plugin 冲突（通过 `.npmrc` hoist 解决）。

Next steps (pick one):
1) 我帮你再跑一遍前后端联调，验证“提炼队列 + 自定义提示词”全流程  
2) 你确认右侧卡片文案/模板默认值后，我再细化交互与提示词库  
3) 如果想把“引用区”作为显式输入（例如只提炼选中引用），我继续扩展 UI + API 协议
