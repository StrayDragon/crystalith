# openspec（规格与变更跟踪）

> TL;DR：本目录承载本仓库的 spec-driven 工作流：canonical specs 在 `openspec/specs/`；变更工作区在 `openspec/changes/`（当前可见命名形态为 `c<id>-<slug>/`，例如 `openspec/changes/c10-...`）；归档在 `openspec/changes/archive/`；暂缓/搁置在 `openspec/notplan-changes/`。规则说明：`openspec/AGENTS.md`，上下文配置：`openspec/config.yaml`。

## Scope（责任边界）

### 做什么
- 作为“需求/设计/任务/验证”的主记录：
  - canonical specs：`openspec/specs/<capability>/spec.md`（约定：`openspec/AGENTS.md`）
  - change workspace：`openspec/changes/<...>/`（约定：同上；示例 workspace 含 `proposal.md/tasks.md/design.md/specs/...`：见 `openspec/changes/c1007-doc-governance-drift-checks-and-spec-code-coverage/`）
- 为工程实践提供一致的上下文（命令、约定、治理规则）：`openspec/config.yaml`（其中包含 backend/frontend 命令清单与 doc governance 规则）。

### 不做什么
- 不替代代码实现；实现位于 `backend/`、`frontend/` 等模块。
- 不存放生成物（规则：`AGENTS.md` 对 `*.gen.*` 与 AUTOGEN 注入块有明确禁改约束）。

### 典型使用场景
- 新功能/重构：先在 `openspec/changes/` 创建变更工作区（结构约定：`openspec/AGENTS.md`），再实现代码并同步 specs。
- 维护质量门/回归：`openspec/specs/quality-and-regression/core_suite.json` 作为前端 `test:core` SSOT（引用：`frontend/web/AGENTS.md`）。

## Integration（与项目的关系）

### 上游依赖
- 仓库约定与命令：`openspec/config.yaml` 中的 context（来源于实际目录与 `justfile`/子项目命令）。
- 变更工作区内容：`openspec/changes/*` 内的 `.openspec.yaml`、`proposal.md`、`tasks.md`、`design.md` 等（例如：`openspec/changes/c1007-doc-governance-drift-checks-and-spec-code-coverage/`）。

### 下游使用者
- 开发者在实现前/实现中/验收时参考（`openspec/AGENTS.md` 的 workflow 段落）。
- 测试门/脚本引用：
  - `frontend/web/AGENTS.md` 引用 `openspec/specs/quality-and-regression/core_suite.json`

### 依赖关系图
~~~text
openspec/specs/<capability>/spec.md  <--- sync/merge ---  openspec/changes/<change>/specs/<capability>/spec.md
          ^                                                           |
          |                                                           +-- proposal.md / tasks.md / design.md
          |
backend/ + frontend implementation guided by specs + tasks verification commands
~~~

## Core Logic（核心概念与核心数据流）

### 术语表
- capability：能力域（canonical specs 的一级目录名，见 `openspec/specs/`）。
- change workspace：一次变更的工作区（`openspec/changes/` 下的目录；当前 repo 可见为 `c<id>-<slug>` 命名）。
- delta spec：变更中对 spec 的增量（位于 change workspace 的 `specs/<capability>/spec.md`，见 `openspec/AGENTS.md`）。
- archive：完成后归档的变更（`openspec/changes/archive/`，见同上）。

### 主流程（高层）
1. 创建/迭代变更：在 `openspec/changes/.../` 下更新 `proposal.md`、`tasks.md` 等（约定：`openspec/AGENTS.md`；示例：`openspec/changes/c1007-.../tasks.md`）。
2. 实现代码：按 `tasks.md` 的任务顺序在相应模块实现（backend/frontend）。
3. 更新 delta specs：在 change workspace 内维护 `specs/<capability>/spec.md`（示例存在于 `openspec/changes/c1007-.../specs/quality-and-regression/spec.md`）。
4. 完成后：
   - 将 delta specs 同步到 canonical `openspec/specs/`（约定：`openspec/AGENTS.md`）
   - 归档变更到 `openspec/changes/archive/`（约定：同上）

### 重要边界条件
- `openspec/AGENTS.md` 明确：如果 repo 约定变化，应同步更新 `AGENTS.md`（根）与 `openspec/config.yaml`，避免 spec drift。
- openspec 维护脚本会修改/重写文件（需要谨慎）：
  - 变更编号重排：`scripts/openspec/renumber_changes.py`（会重命名目录并重写引用）
  - 重建优先级索引：`scripts/openspec/rebuild_priority_index.py`
  - 重排后修复引用：`scripts/openspec/repair_change_refs_after_renumber.py`

## Dev / Run / Test（开发者使用指南）
- 日常工作主要是编辑 Markdown/YAML 文件（`openspec/` 内）。
- 若要按仓库约定跑验证命令，可参考 `openspec/config.yaml` 中的 Commands 段落（例如 backend/frontend 常用命令清单）。
- `scripts/openspec/*.py` 属于维护脚本（会写文件/改目录；执行前建议先阅读脚本头部与实现）。

## Roadmap（未来方向与优化建议）
- 近期（1–2 周）
  - 在 `openspec/AGENTS.md` 中补充“当前 change 命名约定”（动机：文档与现实一致；收益：减少困惑；风险：需要清点历史；方案：以 `openspec/changes/` 目录实际形态与 `scripts/openspec/renumber_changes.py` 的正则为依据）。
  - 为变更工作区提供最小模板/清单（动机：降低门槛；收益：更一致；风险：模板维护；方案：基于 `openspec/AGENTS.md` 的 artifacts 列表与现有 change 示例（如 `openspec/changes/c1007-...`）整理）。
- 中期（1–2 月）
  - 自动化“delta specs → canonical specs”的同步检查（动机：避免遗漏；收益：更少 drift；风险：工具投入；方案：先在 `just check` 里增加只读校验（不引入新工具时可用脚本方式））。
  - 将质量门/回归清单与实现映射更显式（动机：可追踪；收益：更快定位缺口；风险：维护；方案：围绕 `openspec/specs/quality-and-regression/core_suite.json` 建立“前端测试 ↔ 后端路由 ↔ 关键文件”映射表）。
- 长期（季度+）
  - 建立跨模块的“能力依赖图谱”（动机：大规模演进；收益：更稳的拆分/重构；风险：信息过载；方案：从 `openspec/specs/` 的 capability 分类出发，逐步补齐关键集成点与回归门）。

## Assumptions / TODO to Verify（已知未知）
- `scripts/openspec/renumber_changes.py` 依赖的 `openspec/changes/priority.json` 在当前 repo 是否存在/如何生成：脚本中 `load_priority_index` 要求该文件存在（路径硬编码），可从 `scripts/openspec/rebuild_priority_index.py` 的输出逻辑确认。
- 当前 change 工作区的最小 artifact 集合是否强制：从 `openspec/AGENTS.md` 的 “typical” 与多个 `openspec/changes/*` 示例对照确认（例如 `openspec/changes/c10-...` 仅含 `.openspec.yaml`/`proposal.md`）。
