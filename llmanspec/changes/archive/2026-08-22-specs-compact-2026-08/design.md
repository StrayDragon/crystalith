# Design — specs-compact-2026-08

## 目标与非目标

- **目标**：在不改变任何规范行为的前提下，修复正确性缺陷、清除违反「Spec 书写守则」的内容、合并冗余。
- **非目标**：新增行为合约；重排 capability 命名体系；BDD feature 改造。

## 关键设计决策

### D1 正确性优先于风格清理

两条 TOON 截断正文（workspace-api-contract r18 / web-extractor-plugins r185）按实现现状
补全为完整行为语句；r401↔r304 默认值矛盾以「表单初始态 ≠ API 省略默认 + UI MUST 显式传参」
消解——两侧 requirement 均保留，不删除任一侧。

### D2 魔法数字 → config schema（数值不进 spec）

策略：**公式/方向/封闭枚举留 spec，具体默认值归 `config/app.yaml` + Zod config schema**。
豁免：HTTP 状态码集合、`<768px` 设计断点等协议常量。改写模板：
`MUST 可配置且默认值 MUST 来自 config schema（MUST NOT 硬编码于实现）`。

### D3 迁移叙事 → 当前态单一声明

v1 锚定（align-v1 req_id、like-v1、alembic）与一次性任务叙述（r225 数据迁移、501-stub 替换、
c80/c81/c65/c103 变更编号）一律改为正向当前行为描述；req_id 重命名同步更新 requirements 与
scenarios 两处引用。

### D4 冗余合并采用 canonical + 引用模式

每组冗余指定唯一 canonical，其余条目改为「见 <spec> rNN」或整条删除：

| 组                            | canonical             | 处置                                |
| ----------------------------- | --------------------- | ----------------------------------- |
| api/generated stay-deleted ×3 | openapi r95           | r168 删（唯一语义并入 r95）；fm3 删 |
| Eden+shared 类型 SSOT         | openapi r95/r132      | frontend fm1 删                     |
| 本地暂存禁令 ×3               | deep-research-ui r419 | r442 改引用                         |

### D5 capability 合并边界

仅合并满足「单条守卫/占位」形态的 capability：

- `structural-refinement-for-generated-results`：自述废弃的纯占位 → **整体删除**
- `background-jobs-and-task-runtime`：单条退役守卫 → 并入 architecture-core（`r_taskqueue_retired`）
- `frontend-eden-migration`：**保留**（余下 5 条为 SSE/ownership/错误解析等独有约束），仅删重复条目

多对多 R 组（R1/R4/R6/R7/R9…）涉及跨 spec 引用面核对，**推迟到后续批次**（见 tasks.md 遗留项），
避免单次变更 diff 过大难以评审。

### D6 行为保持性验证口径

- `llman sdd validate --specs --strict --no-interactive` 全绿（35/35）
- diff 审查口径：每条被删 MUST/SHALL 行必须能对应到同 commit 内的替代行或 canonical 引用
- req_id 除 align-v1 改名外保持稳定；scenarios 计数行与实际行数严格一致（TOON 数组长度）

## 回滚边界

全部改动位于 `llmanspec/specs/**` 与 change 文档，无代码/配置联动；
revert 对应 commit 即可完全回滚，无派生工件需要再生成。

## D7 后续批次（不在本 change 完成口径内）

### Type-a 函数名/文件路径去锚定（约 20 条，低风险改写）

- deep-research-runtime r327/r328 scenarios（writeBackNodeWork/runLoop/synthesizeAndComplete/drain）
- deep-research-ui r425/r430/r433/r438/r451/r457
- bdd-test-harness（run.test.ts/SKIP_FEATURE_DIRS 等测试文件名）
- retrieval-and-cache（EpochCache/EmbedStrategy/ragRegistry.retrieveWith/searchVectors）
- configuration-governance r158（getDataRoot() 等 accessor 名）

### 跨 capability 冗余合并（R 组，需逐组核对引用面）

- R1 camelCase wire：workspace-api-contract r75/r284/r285 ↔ openapi r132 ↔ fm r286/r287
- R3 OpenAPI/AsyncAPI 同步四条收敛至 openapi-and-client-generation
- R4 notebook-scoped 四条收敛为两条（workspace-api-contract 内部）
- R5 提取器偏好/fallback：web-extractor-plugins 作 canonical
- R6 `/prompt:` 解析五处合一（chat-prompt-presets canonical）
- R7 stats preset 内部三对一（chat-prompt-presets）
- R9/R10 tag 批量结果与大小写唯一性（management-and-tags 内部）
- R11 from-url link 模式重复条目；R12 embedding 失败不置 ready 引用化
- R14 epoch 失效模型重述条目引用化
- R17 深研 API↔UI 配对条目引用化
