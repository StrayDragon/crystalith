# Crystalith 阶段性 QA / 收敛进度（临时）

> **性质**：临时工作台账，完成后可删除或归档。  
> **约束**：**全程不触发任何 llman SDD**（不 propose / apply / verify / archive）。合约漂移先靠代码与文档收敛；specs 卫生若做，也只是手改文件，不开 SDD change。  
> **北极星**：最少代码 · 一致校验 · Zod/Eden SSOT · 降低理解成本 · 用对的模式做对的事。

**来源**：Wave A（架构 / 流程门禁 / Spec 漂移）只读体检。  
**最后更新**：2026-07-19

---

## 0. 协作原则（已锁定）

| 原则 | 含义 |
| --- | --- |
| **Eden 一等公民** | 一等客户端 = `treaty<App>`（`apps/web/src/api/eden.ts`）。请求/响应形状优先从 Elysia 路由 + Zod 推断，不维护平行 DTO 目录。 |
| **Zod 有明确使用面** | 见下方「Zod 使用面」；范围固化进 `AGENTS.md`（本进度完成后写入）。 |
| **OpenAPI 是衍生面** | 实时 `/openapi` / `/openapi.json`（zod-to-openapi）服务人类与**未来其他 client**；不反向生成一等 TS client。 |
| **无 SDD 本轮** | 不走 llman pipeline；大改用小步提交 + `just check` / 相关测试。 |
| **先 SSOT，再清理** | 类型/校验收敛优先于大删神文件；死代码在 SSOT 稳定后 Cleanup。 |

### Zod 使用面（拟定 → 将写入 AGENTS.md）

| 层 | Zod 做什么 | 不做什么 |
| --- | --- | --- |
| `packages/shared/src/schemas/` | **HTTP / 跨端合约 SSOT**：body、query、response、共享领域类型；`.describe(desc(...))`；API 级宜 `.openapi(...)` | 不放纯 UI 状态、不放仅服务端内部临时 shape（除非即将上线到 API） |
| `apps/server` 路由 | `body` / `query` / `params` / 响应约束 **只引用** `@crystalith/shared` | 禁止平行 `z.object` 复制合约；禁止 Elysia `t.*` |
| `apps/server` 内部（AI agent / pipeline） | 仅当该结构**就是**（或即将是）对外合约时用 shared；否则可用局部 schema，但**不得**与 shared 同名异形 | 禁止「shared 有一份、agent 又有一份字段不同」 |
| `apps/web` | **优先 Eden 推断类型**；需要标称类型时从 `@crystalith/shared` import | 禁止 `shared-types.ts` / `workspace/shared/types.ts` 再造 wire DTO |
| 配置 | `config` 的 Root schema 可暂留 server（已有 `app.schema.gen.json` 门禁）；models 等切片已在 shared | 不把 HTTP 合约塞进 config schema |
| OpenAPI | 由 shared Zod + 路由注册 **实时**导出 | 不恢复 hey-api / `api/generated` 作为一等 client |

---

## 1. 总进度一览

| Phase | 主题 | 状态 |
| --- | --- | --- |
| P0 | 门禁解阻塞（能跑 `just lint`） | ⬜ |
| P1 | Zod / Eden SSOT 收敛（核心） | ⬜ |
| P2 | Zod 使用面写入 AGENTS.md + 文档对齐 | ⬜ |
| P3 | 门禁真相（qa 组成、假绿项） | ⬜ |
| P4 | Cleanup A（死代码 / 死配置，无行为变更） | ⬜ |
| P5 | Spec 卫生（手改 toon，**不开 SDD**） | ⬜ |
| P6 | 可选：瘦 CI / SECURITY / 余债 | ⬜ |

---

## 2. 详细 TODO

### P0 — 门禁解阻塞

- [ ] **P0.1** 修复 `e2e/fixtures/test.ts` `no-empty-pattern`（FLOW-03），使 `bun lint` / `just check` 可通过  
- [ ] **P0.2** 本地确认：`bun lint`、`bun typecheck` 绿（不必全跑 e2e，除非顺手）

### P1 — Zod + Eden SSOT（首要，按依赖顺序）

> 目标：删掉平行类型岛；server 路由与 AI 结构化输出对齐 shared；web 以 Eden 类型为主、shared 为辅。

- [ ] **P1.0 盘点**（短文档可写在本文件附录）：列出仍存在的平行类型 / 本地 Zod 合约  
  - [ ] `apps/web/src/api/shared-types.ts` 导出清单 vs Eden / shared  
  - [ ] `apps/web/src/features/workspace/shared/types.ts` 中 wire 相关 vs UI-only  
  - [ ] server 内本地 `z.object` 与 shared 重名或同域（research / studio / outputs / …）  
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

**正在做**：_(尚未开始 — 待确认从 P0.1 起手)_  

**下一步建议**：`P0.1` → `P1.0` → `P1.1` …

---

## 4. 决策记录（短）

| 日期 | 决策 |
| --- | --- |
| 2026-07-19 | 先 QA/优化出结果，再提炼 skill；不先写元 skill |
| 2026-07-19 | Wave A 选轨 1/2/3/5；不做产品关键路径轨 4 |
| 2026-07-19 | 本轮 **不触发 llman SDD** |
| 2026-07-19 | 优先 Zod 非 SSOT + Eden；OpenAPI 为衍生面 |
| 2026-07-19 | 用 `_PROGRESS.md` 勾选推进 |

---

## 5. 附录 — Wave A 索引（查找用）

- 架构：ARCH-01…15（[Architecture health](8159bc1d-e5f3-4736-b8a2-56887a3e16f3)）  
- 流程：FLOW-01…13（[Dev workflow QA](b1cd953d-ca97-4422-b5a7-0e39a43023cd)）  
- 漂移：DRIFT-01…15（[Spec-code drift](5c111d8b-1122-46ef-8a02-87c7578f1ab6)）  

完整合并叙述见会话 Wave A 报告；执行以本文件勾选为准。
