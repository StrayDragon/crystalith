# OpenSpec changes 合并设计（2026-03-23）

## 目标

- 在 `openspec/changes/` 内，尽可能把重复/高度相似的 proposal 合并成更少的 change。
- 保留一个“合并后”的 change（含新的 `proposal.md`），删除旧 change（依赖 git 可回滚）。
- 合并后保持引用可用：`openspec/**` 中不应再引用已删除的 change。
- 合并过程中按既定优先级段位：`重构(1000)` > `架构优化(2000)` > `用户体验(3000)` > `新功能(4000)`。

## 合并规则（推荐策略：半自动聚类 + 人工确认）

1. **确定簇（cluster）**：基于 slug/token 的相似度 + `proposal.md` 中 capability/依赖的重叠，形成候选簇。
2. **选择保留的 change（canonical）**：
   - 跨优先级段：保留更高优先级段的 change code（例如 `2000` 优先于 `3000`）。
   - 同段内：优先保留更小 code（便于稳定引用）。
3. **命名（folder slug）**：
   - 若 canonical 的 slug 已覆盖合并范围：保持不变。
   - 若合并后范围显著扩大：将 canonical 重命名为更通用的 slug（尽量复用被合并 change 的 slug，避免过长）。
4. **内容合并（proposal.md）**：
   - 以更“细/可执行”的 proposal 为主干，补齐另一份的差异点。
   - 合并 `Why/What Changes/Capabilities/Impact/Dependencies`，去重并分组。
   - capability key 如明显重复：收敛为一个主键，并同步修正 `openspec/**` 的引用（不做长期兼容别名）。
5. **引用修复**：
   - 替换 `openspec/**` 中旧 change folder name 与旧 `cNNNN` code → canonical。
   - 删除旧 change 目录后，做一次全量 `rg` 检查：确保无残留引用。
6. **复核与索引**：
   - 重建 `openspec/changes/priority.json` + `openspec/changes/PRIORITY.md`。
   - 更新 `openspec/changes/MERGE_PROGRESS.md` 记录合并清单与结果。

## Wave 1（按顺序执行）

1. `c2025` + `c2064`（concurrency budgets/backpressure）
2. `c2020` + `c2079`（dev diagnostics workbench/state dumps）
3. `c2167` + `c3002`（frontend error UX + recovery actions）
4. `c2033` + `c3007`（command intent routing / composition）
5. `c2021` + `c2158`（OpenAPI/SDK drift gates + release playbook）
6. `c2223` + `c2224`（tool config contract + UI）
7. `c1042` + `c1050`（backend feature module conventions + migration sweep）
8. `c1002` + `c1043`（DB drift gates + sqlite baselines）
9. `c4062` + `c4064`（diagnostics export pack + perf traces）
10. `c4035` + `c4037`（section locking & incremental regen：slides/report）
11. `c2074` + `c4019`（output renderer unification）
12. `c4028` + `c4029` + `c4058` + `c4059`（source connector plugins pack）
