# Crystalith 阶段性 QA / 收敛进度（临时）

> **性质**：临时工作台账，完成后可删除或归档。  
> **约束**：**全程不触发任何 llman SDD**（不 propose / apply / verify / archive）。合约漂移先靠代码与文档收敛；specs 卫生若做，也只是手改文件，不开 SDD change。  
> **北极星**：最少代码 · 一致校验 · Zod/Eden 各司其职 · 降低理解成本 · 用对的模式做对的事。  
> **批次纪律**：每个合理批次验收通过后 **commit**；有问题随时停并报告。

**来源**：Wave A（架构 / 流程门禁 / Spec 漂移）只读体检。  
**最后更新**：2026-07-19（P3.1A：web Vitest 纳入 just qa）

---

## 0. 协作原则（已锁定）

### 0.1 Eden 与 Zod **不等价**（关键认知）

```text
shared Zod（或路由挂载的 schema）
    → Elysia 运行时校验 + 推断 handler / App 类型
    → export type App = typeof app
    → Eden treaty<App>：编译期把类型带到 web（不做 resp 的 Zod 再解析）
    → OpenAPI：由同一份 Zod 衍生（其他语言 client）
```

| 误解                                     | 正解                                                                        |
| ---------------------------------------- | --------------------------------------------------------------------------- |
| 「web↔server 用 Eden 就可以去掉 Zod」    | **否**。Eden 无运行时校验；去掉路由 schema 会失去 422 校验与可信 OpenAPI。  |
| 「Eden 的 req/resp 类型能替代 Zod 校验」 | **否**。Eden = 类型管道；Zod = 运行时契约（+ OpenAPI / AI / config 原料）。 |
| 「Zod 和 Eden 二选一」                   | **否**。冗余来自**平行 DTO**，不是 Zod+Eden 并存。                          |

**本轮目标**：保留 server 侧 Zod SSOT；用 Eden 消灭 web 平行 wire 类型；对齐同域异形 schema。  
**不追求**：API 零 Zod。

### 0.2 原则表

| 原则                                        | 含义                                                                      |
| ------------------------------------------- | ------------------------------------------------------------------------- |
| **Eden 一等公民（web）**                    | 一等客户端 = `treaty<App>`。不维护平行 wire DTO 目录。                    |
| **Zod 一等公民（server 校验 + 配置 + AI）** | 路由 body/query/params/response、yaml/env、`generateObject` 的合约原料。  |
| **OpenAPI 是衍生面**                        | `/openapi.json` 服务人类与**未来其他 client**；不反向生成一等 TS client。 |
| **无 SDD 本轮**                             | 不走 llman pipeline；小步提交 + 验收。                                    |
| **先 SSOT，再清理**                         | 类型/校验收敛优先于大删神文件。                                           |

### 0.3 Zod 使用面（拟定 → P2 写入 AGENTS.md）

| 层                             | Zod 做什么                                                                 | 不做什么                                                           |
| ------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `packages/shared/src/schemas/` | **HTTP / 跨端合约 SSOT**；`.describe(desc(...))`；API 级宜 `.openapi(...)` | 纯 UI 状态；未上线的一次性内部 shape（若与 shared 同名异形则禁止） |
| `apps/server` 路由             | 挂载 shared Zod → **运行时校验** + 喂给 `App`/Eden                         | 平行 `z.object` 复制合约；Elysia `t.*`                             |
| `apps/server` 内部 AI          | 与对外合约一致则用 shared；否则局部 schema **不得**与 shared 同域异形      | shared 一份、agent 又一份字段不同                                  |
| `apps/web`                     | **Eden 推断类型**；标称类型可从 `@crystalith/shared`                       | `shared-types` / `workspace/types` 再造 wire DTO                   |
| **配置 yaml/env**              | **必留席位**（Root schema + 门禁）                                         | 把 HTTP 合约塞进 config                                            |
| OpenAPI                        | 由 **同一份** 路由/shared Zod 实时导出                                     | hey-api / `api/generated` 一等 client                              |

---

## 1. 总进度一览

| Phase | 主题                                     | 状态                                           |
| ----- | ---------------------------------------- | ---------------------------------------------- |
| P0    | 门禁解阻塞（能跑 `just lint`）           | ✅                                             |
| P1    | Zod / Eden SSOT 收敛（核心）             | ✅ P1.2–1.8 + rem + connectors + response/eval |
| P2    | Zod 使用面写入 AGENTS.md + 文档对齐      | ✅                                             |
| P3    | 门禁真相（qa 组成、假绿项）              | ✅ + web Vitest 入 qa（P3.1A）                 |
| P4    | Cleanup A（死代码 / 死配置，无行为变更） | ✅ P4.1–4.5（P4.6 可选延后）                   |
| P5    | Spec 卫生（手改 toon，**不开 SDD**）     | ⬜                                             |
| P6    | 可选：瘦 CI / SECURITY / 余债            | ⬜                                             |

---

## 2. 详细 TODO

### P0 — 门禁解阻塞

- [x] **P0.1** 修复 `e2e/fixtures/test.ts` `no-empty-pattern`（FLOW-03），使 `bun lint` / `just check` 可通过
- [x] **P0.2** 本地确认：`bun lint`、`bun typecheck` 绿（不必全跑 e2e，除非顺手）

### P1 — Zod + Eden SSOT（首要，按依赖顺序）

> 目标：删掉平行类型岛；server 路由与 AI 结构化输出对齐 shared；web 以 Eden 类型为主、shared 为辅。

- [x] **P1.0 盘点**（短文档可写在本文件附录）：列出仍存在的平行类型 / 本地 Zod 合约
  - [x] `apps/web/src/api/shared-types.ts` 导出清单 vs Eden / shared
  - [x] `apps/web/src/features/workspace/shared/types.ts` 中 wire 相关 vs UI-only
  - [x] server 内本地 `z.object` 与 shared 重名或同域（research / studio / outputs / …）
- [x] **P1.1 Research 合约对齐**（ARCH-02 / ARCH-11）
  - [x] `agent.ts` 改用 / 对齐 `packages/shared` 的 research schemas（消掉 `coverage` vs `coverageEstimate` 等漂移）
  - [x] `ResearchStatus` 等 DTO 单一来源；web `useResearch` 去掉平行 union
- [x] **P1.2 Output / RenderDescriptor 收敛**（ARCH-04 相关）
  - [x] shared 补齐 `RenderDescriptor` / `FieldDescriptor` / `FrontendBundle` / `OutputMeta`；`PluginConfig` 对齐 slides config
  - [x] server `generator` + web `types` 去平行接口；`OUTPUT_META` 数据仍留 server
  - [ ]（延后）`OutputContentByType` → shared content schemas；`frontendBundle` 发射；路由 Zod 挂载
- [x] **P1.3 Studio outline**（ARCH-10）
  - [x] `studio/service.ts` 改用 shared `SlidesOutlineSchema`
- [x] **P1.4 Web：Eden 优先迁移**
  - [x] 域：`refine`（`useRefine` 不再依赖 `shared-types`；wire → `unknown` normalize → UI types）
  - [x] 域：`sources`（tag/chunk/extractor/QA → `@crystalith/shared`）
  - [x] 域：`diagnostics`（`WorkspaceToolsDiagnostics` → `workspace/shared/types`；**删除** `shared-types.ts`）
  - [x] 域顺序：~~`refine`~~ → ~~`sources`~~ → ~~`diagnostics`~~ ✅
  - [x] 删除 `apps/web/src/api/shared-types.ts`
- [x] **P1.5 Web：`workspace/shared/types.ts` 瘦身**
  - [x] wire DTO 外迁到 shared 或改 Eden；UI-only 类型留下并标注
  - [x] 删除全部 `Api*`；normalize 改用 `@crystalith/shared`；`SourceSearchResult` 补 type export
  - [x] 文件头标注 UI-only；`just qa` 绿后本波 commit → **暂停**
- [x] **P1.6 路由 Zod 审计**
  - [x] 盘点：多数路由未挂载；无本地 `z.object` 平行定义
  - [x] Tier1 挂载：notebooks PATCH、refine、research create/modify、outputs generate/types、sources（tags/batch/search/from-url/extractors）
  - [x] shared 扩展：`notebookId`（refine/research）、`OutputGenerateRequestSchema`、`SourceSearchStatus` + `no_results`
  - [x] 余量挂载：qa（request/export/answer）、studio（create/list/patch/outline/markdown）、sessions convert、sources upload query、citations context
  - [x] source-connectors：shared 完整合约 + create/apply/import-scope 挂载；server/web 平行 types 改 re-export
  - [x] response/低成本 + eval：tasks/models/workspace/commands/rag response；eval datasets/runs 写路径；rag strategies POST body
  - [ ]（可选）templates list response 等更细 OpenAPI 装饰；eval get/export 完整 response
- [x] **P1.7 OpenAPI 抽检**
  - [x] shared 关键 schema 字段均为 camelCase；notebooks OpenAPI resp 为 `createdAt`/`updatedAt`
- [x] **P1.8 回归**
  - [x] `bun typecheck` + `just qa`（本波 commit 前）
  - [x] 余量波次再跑 `just qa` 绿

### P2 — 固化约定到 AGENTS.md

- [x] **P2.1** 在根 `AGENTS.md`「Zod SSOT」节补充：**使用面表**（上节定稿版）+ **Eden 一等 / OpenAPI 衍生** 两段
- [x] **P2.2** 更新 `apps/web/AGENTS.md`：删除「types in shared-types.ts」作为常态描述；改为 Eden + shared
- [x] **P2.3** 更新项目结构注释中 `api/` 一行（与现实一致）
- [x] **P2.4**（追加）`apps/server/AGENTS.md` 点明配置 Zod 席位 + Eden≠Zod

### P3 — 门禁真相（工程可信度）

> **2026-07-19**：整包推荐落地后，追加 **P3.1A**（web Vitest 纳入 `just qa`）。

**实际 `just qa`**：
`check` → `check-env-examples` → `check-app-schema` → `test`（server+shared）→ `test-web`（`apps/web` `test:ci`）→ `e2e`（`@p0`）。
**门外**：`just test-bdd`、`just type-aware-lint`。`check-bun` 可选、不入 qa。

- [x] **P3.1B→A** 先降级措辞；后将 web Vitest 纳入 qa（`just test-web`）
- [x] **P3.2A** `scripts-harness-check` 移出 qa → 可选 `just check-bun`
- [x] **P3.3B** `init_config` / `upsert-env-configs` 标 legacy；推荐 `.env.example` + `CL_*`
- [x] **P3.4** `AGENTS.md` qa 组成 + Tier + 门外列表
- [x] **P3.5A** `_E2E.md` 对齐 26 `@p0`（A/N/S/C/O/L）
- [x] **P3.6A** type-aware 正式标 advisory（不入 qa）
- [x] **P3.7A** `just test-bdd` + server/PR 文档

### P4 — Cleanup A（无用户可见行为变更）

- [x] **P4.1** 删除或隔离未使用的 frontend `domains/outputs/plugins/` 注册表死路径（ARCH-03）
- [x] **P4.2** 移除死 Chroma / `vector_storage` 配置面（ARCH-07）
- [x] **P4.3** `normalizeMindmapNode` 单点化（ARCH-14）
- [x] **P4.4** Layer：去掉硬编码 z-index 逃逸（ARCH-13）
- [x] **P4.5** `.oxlintrc` 等陈旧 ignore（`backend/py/`、`api/generated/`）
- [ ] **P4.6**（可选）神文件拆分 — **靠后**，仅在 SSOT 稳定后按痛点拆（ARCH-05）

### P5 — Spec 卫生（手改，不开 SDD）

> 仅在 P1–P3 有余力时；目的是去掉 **假信心**，不是开 change。

- [ ] **P5.1** `quality-and-regression`：改写为 `just qa` / bun / Playwright 现实（DRIFT-01）
- [ ] **P5.2** `architecture-core`：`router.ts` / `apps/server` 布局（DRIFT-02）
- [ ] **P5.3** `workspace-api-contract`：`/v2`（DRIFT-03）
- [ ] **P5.4** 清除已修复的「当前 v2 未实现」表述（DRIFT-04）
- [ ] **P5.5** `openapi` / `frontend-eden` purpose TBD + 迁移期措辞（DRIFT-07）
- [ ] **P5.6** 孤儿能力标注 deferred 注释块（DRIFT-10）— 不删文件除非明确要求
- [ ] **P5.7** c13：能力名碰撞记录在案；**不在本轮改 c13 结构**（除非单开），仅在本文件备注（DRIFT-11）

### P6 — 可选 / 以后

- [ ] **P6.1** 瘦 GitHub Actions（FLOW-02 / DRIFT-09）
- [ ] **P6.2** `SECURITY.md`（DRIFT-08）
- [ ] **P6.3** `strategy_configs` 并入 Drizzle schema SSOT（ARCH-06）
- [ ] **P6.4** OpenAPI `.openapi()` 注解补全（ARCH-12）
- [ ] **P6.5** c13 / Eden→server 包耦合（ARCH-15）— 随分发再议
- [ ] **P6.6** 本阶段结束后：从本文件提炼 skill（**有结果后再做**）

---

## 3. 当前焦点

**正在做**：_(P3.1A web Vitest 入 qa 完成)_

**已完成批次**：

- P0 / P1.0–P1.5 / P2 / P4.1–4.5
- **P1** 路由 Zod 主线（含 rem/connectors/response/eval）
- **P3** 门禁真相整包 + **web Vitest 纳入 just qa**

**下一步**：P5 Spec 卫生 / push

---

## 4. 决策记录（短）

| 日期       | 决策                                                                       |
| ---------- | -------------------------------------------------------------------------- |
| 2026-07-19 | 先 QA/优化出结果，再提炼 skill；不先写元 skill                             |
| 2026-07-19 | Wave A 选轨 1/2/3/5；不做产品关键路径轨 4                                  |
| 2026-07-19 | 本轮 **不触发 llman SDD**                                                  |
| 2026-07-19 | **Eden ≠ Zod**：保留 server Zod；Eden 消 web 平行 DTO；不追求 API 零 Zod   |
| 2026-07-19 | 用 `_PROGRESS.md` 勾选；每批次验收后 commit                                |
| 2026-07-19 | 配置 Zod 必留；API Zod 作校验+App/OpenAPI SSOT                             |
| 2026-07-19 | P1.1 遗留清扫 + P2 AGENTS 固化（同批提交）                                 |
| 2026-07-19 | P1 路由 Zod 主线收完（含 rem/connectors/response/eval）；门禁波次先 commit |
| 2026-07-19 | P3 先只读盘点再拍板；不默认扩 `just qa`                                    |
| 2026-07-19 | P3 整包：1B+3.2A+3.3B+3.4+3.5A+3.6A+3.7A（消假绿，少动门禁内容）           |
| 2026-07-19 | P3.1A：`just test-web`（apps/web test:ci）纳入 `just qa`                   |

---

## 5. 附录 — Wave A 索引（查找用）

- 架构：ARCH-01…15（[Architecture health](8159bc1d-e5f3-4736-b8a2-56887a3e16f3)）
- 流程：FLOW-01…13（[Dev workflow QA](b1cd953d-ca97-4422-b5a7-0e39a43023cd)）
- 漂移：DRIFT-01…15（[Spec-code drift](5c111d8b-1122-46ef-8a02-87c7578f1ab6)）

完整合并叙述见会话 Wave A 报告；执行以本文件勾选为准。

---

## 6. 附录 — P1.0 盘点（2026-07-19）

### 6.1 `apps/web/src/api/shared-types.ts`（~212 LOC，8 个 importer）

| 导出                                                            | 处置建议                                                                                             |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `ResearchStatus` / session/step DTOs                            | → `@crystalith/shared`（P1.1）；注意 shared 无 `'error'`，live SSE `error` 是事件不是 session status |
| `Citation` / `CitationContextResponse`                          | → shared `Citation` + Eden/citations 路由类型                                                        |
| `ChunkRead` / extractor / policy / tags                         | **已迁** `@crystalith/shared`（P1.4 sources）                                                        |
| `TaskRead` / tool descriptors / refine 相关                     | **已删**（P1.4 refine）；tools wire 在 `useRefine` 内 `unknown` normalize                            |
| `RenderDescriptor` / `FrontendBundleDescriptor` / plugin schema | → shared output（P1.2）                                                                              |
| `WorkspaceToolsDiagnostics`                                     | Eden diagnostics 或留 UI 宽松类型并标注                                                              |
| `QaMessage` / `OutputTypeInput`                                 | → shared / Eden                                                                                      |

**web 对 `@crystalith/shared` 仅 1 处**：`useChat.ts` 的 `Citation`。

### 6.2 `workspace/shared/types.ts`（UI-only；P1.5 已瘦身）

- **已删**：全部 `Api*` wire DTO（notebook/session/message/output/source/citation/refine/tools…）
- **可留（UI）**：`PanelId`、`ConnectionState`、slide stage、layout、`Citation`（含 UI `id`）、`Notebook`/`SourceItem` 等 view model
- **仍与 shared 重叠（下轮）**：`OutputTypeId`、各 `*OutputContent`、`RenderDescriptor` → **P1.2**
- **normalize**：`utils.ts` 从 `@crystalith/shared`（`Wire*`）映射到 UI types

### 6.3 Server 本地 `z.object`（非测试）

| 位置                                     | 性质                                                                     | 处置                            |
| ---------------------------------------- | ------------------------------------------------------------------------ | ------------------------------- |
| `shared/config.ts`                       | **配置 Zod（必留）**                                                     | P1 不动；属合法席位             |
| `research/agent.ts`                      | **已对齐** shared `ResearchPlanLlmSchema` / `IterationAnalysisLlmSchema` | ✅ P1.1                         |
| `studio/service.ts` `SlideOutlineSchema` | **已对齐** shared `SlidesOutlineSchema`                                  | ✅ P1.3                         |
| `ai/tools/*Args`                         | tool 入参，非 HTTP DTO                                                   | 可接受局部；后续若上 API 再提升 |
| `eval/metrics.ts` `JudgeSchema`          | 评测内部                                                                 | 可接受局部                      |

### 6.4 Research 字段真相（P1.1 — 已完成清扫）

- shared + agent + web + tests + SSE streaming schema：**统一** `coverageEstimate` / `needMore`
- 已删：`shared-types` 内未使用的 Research* DTO；UI `coverage` 别名；streaming 上错误的 `SearchPlanSchema`/`IterationAnalysisSchema` 嵌套（改为 `ResearchPlanLlmSchema` / `IterationAnalysisLlmSchema`）
- `ResearchStatus` 仅 `@crystalith/shared` → `useResearch` re-export；SSE `error` 是事件不是 status

### 6.5 批次切分建议

1. ~~P1.1 Research shared+agent+web~~ ✅
2. P1.3 Studio outline（小批）
3. ~~P1.4 按域消 `shared-types`~~ ✅
4. ~~P1.5 workspace `Api*` 瘦身~~ ✅ → **暂停**
5. P1.2 Output / RenderDescriptor
6. P1.6–P1.8 审计与回归
