# Crystalith 阶段性 QA / 收敛进度（临时）

> **性质**：临时工作台账，完成后可删除或归档。  
> **约束**：**全程不触发任何 llman SDD**（不 propose / apply / verify / archive）。合约漂移先靠代码与文档收敛；specs 卫生若做，也只是手改文件，不开 SDD change。  
> **北极星**：最少代码 · 一致校验 · Zod/Eden 各司其职 · 降低理解成本 · 用对的模式做对的事。  
> **批次纪律**：每个合理批次验收通过后 **commit**；有问题随时停并报告。

**来源**：Wave A（架构 / 流程门禁 / Spec 漂移）只读体检。  
**最后更新**：2026-07-19（澄清 Eden ≠ Zod）

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

| 误解 | 正解 |
| --- | --- |
| 「web↔server 用 Eden 就可以去掉 Zod」 | **否**。Eden 无运行时校验；去掉路由 schema 会失去 422 校验与可信 OpenAPI。 |
| 「Eden 的 req/resp 类型能替代 Zod 校验」 | **否**。Eden = 类型管道；Zod = 运行时契约（+ OpenAPI / AI / config 原料）。 |
| 「Zod 和 Eden 二选一」 | **否**。冗余来自**平行 DTO**，不是 Zod+Eden 并存。 |

**本轮目标**：保留 server 侧 Zod SSOT；用 Eden 消灭 web 平行 wire 类型；对齐同域异形 schema。  
**不追求**：API 零 Zod。

### 0.2 原则表

| 原则 | 含义 |
| --- | --- |
| **Eden 一等公民（web）** | 一等客户端 = `treaty<App>`。不维护平行 wire DTO 目录。 |
| **Zod 一等公民（server 校验 + 配置 + AI）** | 路由 body/query/params/response、yaml/env、`generateObject` 的合约原料。 |
| **OpenAPI 是衍生面** | `/openapi.json` 服务人类与**未来其他 client**；不反向生成一等 TS client。 |
| **无 SDD 本轮** | 不走 llman pipeline；小步提交 + 验收。 |
| **先 SSOT，再清理** | 类型/校验收敛优先于大删神文件。 |

### 0.3 Zod 使用面（拟定 → P2 写入 AGENTS.md）

| 层 | Zod 做什么 | 不做什么 |
| --- | --- | --- |
| `packages/shared/src/schemas/` | **HTTP / 跨端合约 SSOT**；`.describe(desc(...))`；API 级宜 `.openapi(...)` | 纯 UI 状态；未上线的一次性内部 shape（若与 shared 同名异形则禁止） |
| `apps/server` 路由 | 挂载 shared Zod → **运行时校验** + 喂给 `App`/Eden | 平行 `z.object` 复制合约；Elysia `t.*` |
| `apps/server` 内部 AI | 与对外合约一致则用 shared；否则局部 schema **不得**与 shared 同域异形 | shared 一份、agent 又一份字段不同 |
| `apps/web` | **Eden 推断类型**；标称类型可从 `@crystalith/shared` | `shared-types` / `workspace/types` 再造 wire DTO |
| **配置 yaml/env** | **必留席位**（Root schema + 门禁） | 把 HTTP 合约塞进 config |
| OpenAPI | 由 **同一份** 路由/shared Zod 实时导出 | hey-api / `api/generated` 一等 client |

---

## 1. 总进度一览

| Phase | 主题 | 状态 |
| --- | --- | --- |
| P0 | 门禁解阻塞（能跑 `just lint`） | ✅ |
| P1 | Zod / Eden SSOT 收敛（核心） | ⬜ |
| P2 | Zod 使用面写入 AGENTS.md + 文档对齐 | ⬜ |
| P3 | 门禁真相（qa 组成、假绿项） | ⬜ |
| P4 | Cleanup A（死代码 / 死配置，无行为变更） | ⬜ |
| P5 | Spec 卫生（手改 toon，**不开 SDD**） | ⬜ |
| P6 | 可选：瘦 CI / SECURITY / 余债 | ⬜ |

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
- [ ] **P1.1 Research 合约对齐**（ARCH-02 / ARCH-11）  
  - [ ] `agent.ts` 改用 / 对齐 `packages/shared` 的 research schemas（消掉 `coverage` vs `coverageEstimate` 等漂移）  
  - [ ] `ResearchStatus` 等 DTO 单一来源；web `useResearch` 去掉平行 union  
- [ ] **P1.2 Output / RenderDescriptor 收敛**（ARCH-04 相关）  
  - [ ] shared 补齐或统一 `RenderDescriptor` / output meta；server `generator` / web 去三份复制  
- [ ] **P1.3 Studio outline**（ARCH-10）  
  - [ ] `studio/service.ts` 改用 shared `SlidesOutlineSchema`  
- [ ] **P1.4 Web：Eden 优先迁移**  
  - [ ] 逐域把 `shared-types` 引用改为 Eden 推断类型或 `@crystalith/shared`  
  - [ ] 域顺序建议：`refine` → `sources` → `diagnostics/workspace` → 其余  
  - [ ] 删空或大幅缩减 `shared-types.ts`（仅留确认无法从 Eden/shared 得到的 UI 变换类型，并注释原因）  
- [ ] **P1.5 Web：`workspace/shared/types.ts` 瘦身**  
  - [ ] wire DTO 外迁到 shared 或改 Eden；UI-only 类型留下并标注  
- [ ] **P1.6 路由 Zod 审计**  
  - [ ] 每个 `features/*/router.ts`：body/query/response 均来自 shared；无平行合约  
- [ ] **P1.7 OpenAPI 抽检**  
  - [ ] 确认关键路径在 `/openapi.json` 仍反映 camelCase shared schema（实时，非 codegen client）  
- [ ] **P1.8 回归**  
  - [ ] `bun typecheck` + 相关 server/web 测试；必要时 `@p0` 冒烟  

### P2 — 固化约定到 AGENTS.md

- [ ] **P2.1** 在根 `AGENTS.md`「Zod SSOT」节补充：**使用面表**（上节定稿版）+ **Eden 一等 / OpenAPI 衍生** 两段  
- [ ] **P2.2** 更新 `apps/web/AGENTS.md`：删除「types in shared-types.ts」作为常态描述；改为 Eden + shared  
- [ ] **P2.3** 更新项目结构注释中 `api/` 一行（与现实一致）

### P3 — 门禁真相（工程可信度）

- [ ] **P3.1** 决定并落实：`just qa` 是否纳入 `apps/web` `test:ci`（FLOW-01）— 纳入 **或** 降级「ultimate」措辞  
- [ ] **P3.2** 处理 `scripts-harness-check` 近 no-op（FLOW-08）：改名/删出 qa/或做真检查  
- [ ] **P3.3** 对齐 `scripts/init_config.sh` 环境键与 `CL_*` SSOT（FLOW-09）  
- [ ] **P3.4** 刷新 `AGENTS.md` 中 `just qa` 实际组成与 Tier 说明（FLOW-07）  
- [ ] **P3.5** 调和 `_E2E.md` 与 Playwright `@p0` 现实（FLOW-04）— 文档或扩测，二选一写清  
- [ ] **P3.6** type-aware-lint：调规则子集 **或** 正式 document accept（FLOW-05）  
- [ ] **P3.7** BDD：文档标明「CRUD 子集、不在 just qa」**或** 另开 `just test-bdd`（FLOW-06 / DRIFT-05）— **本轮默认接受子集 + 文档**，除非另有指示  

### P4 — Cleanup A（无用户可见行为变更）

- [ ] **P4.1** 删除或隔离未使用的 frontend `domains/outputs/plugins/` 注册表死路径（ARCH-03）  
- [ ] **P4.2** 移除死 Chroma / `vector_storage` 配置面（ARCH-07）  
- [ ] **P4.3** `normalizeMindmapNode` 单点化（ARCH-14）  
- [ ] **P4.4** Layer：去掉硬编码 z-index 逃逸（ARCH-13）  
- [ ] **P4.5** `.oxlintrc` 等陈旧 ignore（`backend/py/`、`api/generated/`）  
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

**正在做**：P1.1 Research 合约对齐（shared ← 对齐 live 字段名）  

**已完成批次**：  
- P0 — lint 解阻塞 + Eden≠Zod 台账  
- P1.0 — 平行类型 / 本地 Zod 盘点（见附录 §6）  

**下一步**：P1.1 → P1.3 Studio outline（小）→ P1.4 web Eden 迁移 …

---

## 4. 决策记录（短）

| 日期 | 决策 |
| --- | --- |
| 2026-07-19 | 先 QA/优化出结果，再提炼 skill；不先写元 skill |
| 2026-07-19 | Wave A 选轨 1/2/3/5；不做产品关键路径轨 4 |
| 2026-07-19 | 本轮 **不触发 llman SDD** |
| 2026-07-19 | **Eden ≠ Zod**：保留 server Zod；Eden 消 web 平行 DTO；不追求 API 零 Zod |
| 2026-07-19 | 用 `_PROGRESS.md` 勾选；每批次验收后 commit |
| 2026-07-19 | 配置 Zod 必留；API Zod 作校验+App/OpenAPI SSOT |
| 2026-07-19 | P1.1：shared research 字段对齐 **live**（`coverageEstimate`/`needMore`），不反向改全仓 |

---

## 5. 附录 — Wave A 索引（查找用）

- 架构：ARCH-01…15（[Architecture health](8159bc1d-e5f3-4736-b8a2-56887a3e16f3)）  
- 流程：FLOW-01…13（[Dev workflow QA](b1cd953d-ca97-4422-b5a7-0e39a43023cd)）  
- 漂移：DRIFT-01…15（[Spec-code drift](5c111d8b-1122-46ef-8a02-87c7578f1ab6)）  

完整合并叙述见会话 Wave A 报告；执行以本文件勾选为准。

---

## 6. 附录 — P1.0 盘点（2026-07-19）

### 6.1 `apps/web/src/api/shared-types.ts`（~212 LOC，8 个 importer）

| 导出 | 处置建议 |
| --- | --- |
| `ResearchStatus` / session/step DTOs | → `@crystalith/shared`（P1.1）；注意 shared 无 `'error'`，live SSE `error` 是事件不是 session status |
| `Citation` / `CitationContextResponse` | → shared `Citation` + Eden/citations 路由类型 |
| `ChunkRead` / extractor / policy / tags | → Eden 或 shared source schemas（P1.4 sources） |
| `TaskRead` / refine 相关 | → Eden / shared refine+task（P1.4 refine 优先） |
| `RenderDescriptor` / `FrontendBundleDescriptor` / plugin schema | → shared output（P1.2） |
| `WorkspaceToolsDiagnostics` | Eden diagnostics 或留 UI 宽松类型并标注 |
| `QaMessage` / `OutputTypeInput` | → shared / Eden |

**web 对 `@crystalith/shared` 仅 1 处**：`useChat.ts` 的 `Citation`。

### 6.2 `workspace/shared/types.ts`（~520 LOC，~76 exports）

- **可留（UI）**：`PanelId`、`ConnectionState`、slide stage、layout 等  
- **应外迁（wire/payload）**：`OutputTypeId`、各 `*OutputContent`、与 server output schema 重复的结构 → P1.2 / P1.5  

### 6.3 Server 本地 `z.object`（非测试）

| 位置 | 性质 | 处置 |
| --- | --- | --- |
| `shared/config.ts` | **配置 Zod（必留）** | P1 不动；属合法席位 |
| `research/agent.ts` `PlanSearchSchema` / `AnalysisSchema` | 与 shared **同域异形** | **P1.1**：以 live 字段为准改 shared，agent import shared |
| `studio/service.ts` `SlideOutlineSchema` | 与 shared `SlidesOutlineSchema` 重复 | **P1.3** |
| `ai/tools/*Args` | tool 入参，非 HTTP DTO | 可接受局部；后续若上 API 再提升 |
| `eval/metrics.ts` `JudgeSchema` | 评测内部 | 可接受局部 |

### 6.4 Research 字段真相（P1.1 关键）

- **Live 全栈**（agent / router / web / tests）使用：`coverageEstimate`、`needMore`  
- **shared 未使用**：`coverage`、`needMoreSearch`  
- **对齐方向**：改 shared → live 命名（少改面），再让 agent/web 从 shared import  

### 6.5 批次切分建议

1. P1.1 Research shared+agent+web status（本批）  
2. P1.3 Studio outline（小批）  
3. P1.4 按域消 `shared-types`（refine → sources → diagnostics）  
4. P1.2 + P1.5 Output 描述符合并  
5. P1.6–P1.8 审计与回归  

