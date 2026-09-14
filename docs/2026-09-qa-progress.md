# 2026-09 阶段性 QA 台账（编排）

> 2026-09-14 全仓 QA（代码 slop + 产品/用户视角）的收敛编排。三个需要 spec 修正的发现已立
> SDD change（designed 态、未 start，可直接认领）；其余归直接修正波次（无需 SDD，按
> `.agents/skills/crystalith-ssot-qa-batches` 批次纪律：一波一主题、`just qa` 绿再 commit）。
>
> **认领方式**：
>
> - SDD change：`llman sdd change start <id>`（自动建 `sdd/<id>` 分支），按 tasks.md 执行。
> - 直接波次：`git switch -c <自述分支名>`，按本台账该波清单执行；行为合约不变，
>   若实施中发现需要改 MUST/SHALL → 停，切 `/llman-sdd-propose`。

## 0. 结论摘要

整体非 slop 仓库（SSOT 纪律、错误通道、归档纪律良好；无 TODO 债、无注释代码）。真问题
集中在：① Deep Research 链路的诚实性/可靠性；② workspace 前端接线层；③ 合约层「假 SSOT」
（死契约、同名异形）。

## 1. SDD changes（designed，待认领）

| change id                      | 一句话                                                                  | 关键 spec 位置                                 |
| ------------------------------ | ----------------------------------------------------------------------- | ---------------------------------------------- |
| `research-node-chat-honesty`   | 模型失败禁止静默 stub 降级，改显式 error 帧；接线零消费的 chat 事件契约 | `deep-research-runtime`（新增场景）            |
| `research-lab-sse-resilience`  | Run SSE 断线有界重连 + 可见中断态；server 终态等待去 100ms 轮询         | `deep-research-ui`（新增场景）                 |
| `source-search-error-contract` | 引擎不可用返回 `service_error`，与 no_results 可区分；前端消费 status   | `source-ingestion-upload-and-url:66`（补子句） |

## 2. 直接修正波次

### W1 · 用户可见小修（P0，最小批量）

- [ ] `useChat.ts:126-128` 与 `:455`：坏 ternary（两分支相同，非 string 错误变空白）→ 换统一 `parseServerError`（参照 `useSources.ts` 用法）
- [ ] `nodeQuickActions.ts:112`「（Fake）」summary 漏进真实 run：fixture 词汇按 mode 门控（Eden 分支给中性文案）；补一条断言真实 fork proposal 不含 fixture 词汇的 Rstest
- [ ] `outputs/router.ts:541-544` 转来源吞 embedding 失败：补 `errorMessage` 落库 + 日志（对齐 `sources/router.ts:444-455` 模式）

### W2 · 死代码清理（P1）

> 注意：**不要**删 `packages/shared/src/schemas/research.ts:688-715` 的 `ResearchNodeChat*EventSchema`——由 `research-node-chat-honesty` 接线（不是死代码，是未接线）。

- [ ] server：删 `apps/server/src/ai/generate-output.ts`（113 行零引用，已被 `features/outputs/generator.ts` 取代）；删 `shared/ids.ts` 未用 param schema 与仅测试引用的 parse helpers（半途而废的抽象，默认删除；若想转为采用需 PR 说明）；`db/vectors.ts:188 getAllVectors`、`qa/handler.ts estimateTokens` 换名 wrapper
- [ ] shared：删 8 个 `*ListSchema`（Message/Notebook/Output/PromptPreset/Session/Source/StudioSlide/Template——被 `PaginatedSchema(X)` 取代的平行信封）、`OutputTypeMetaSchema`、`SlidesConfigSchemaSchema`、`QaStreamEventNames/Name`
- [ ] web：删整文件死的 `WorkspaceResizeHandle.tsx`、`WorkspacePanelShell.tsx`；`workspace/shared/utils.ts` 9 个死导出；`research-lab/model/reportDocument.ts` 三个无调用方解析器（真实路径在 `markdownToResearchReport.ts`）
- [ ] 每处删除前 grep 复核零引用；`just qa` 全绿

### W3 · research 运行时合规（P1，spec 已有 MUST，纯实现欠账）

> 与 `research-node-chat-honesty` 都动 `node-chat.ts`：**先做该 change，再进本波**（或反之及时 rebase）。

- [ ] 互斥强制化（条款：`deep-research-runtime.feature`「Node chat SSE proposals only」r98「chat 与 work-unit MUST 互斥（拒绝或排队）」、:154）：runLoop 启动检查 `llmActivity==='node_chat'` 则拒绝/排队（现状 `run-loop.ts:867` 无条件置位不检查）；chat 进行中 `add-budget` 触发的 `scheduleRun`（`commands.ts:474-499`）同口径
- [ ] config 默认值收敛：`shared/config.ts:263/819/1016` 三份 ResearchSettings 字面量 → 单一 SSOT 常量喂给 schema `.default()` 与 fallback；`research-core.ts:100-103` 改用既有 `getResearchSettings()`
- [ ] `node-agent.ts:315` node_chat 步数硬编码 8 → 进 config（与 `getWorkUnitMaxSteps()` 同源）

### W4 · 查询性能（P2）

- [ ] `sources/router.ts:537-564` sortBy='size' 比较器内发 COUNT → 列表预取一次映射后排序
- [ ] `sources/router.ts:477-496` enrichSources 每行 2 查询 → 批量聚合；顺带删 `:504` 名不副实的「N+1 fix」注释

### W5 · UX 一致性（P2）

- [ ] 取消 run 加确认：`ResearchTasksDrawer.tsx:171-183` 接 ConfirmPopover（对齐删除笔记本/输出标准）
- [ ] `window.prompt/confirm` 收敛：`LabNodeDrawer.tsx:201/208/800`、`useSources.ts:299/763` → 组件化（自绘 LabMutationDialogs / ConfirmPopover 已有）
- [ ] 原始 error 直出 UI → 推广 `mapTransportError` 式翻译：`ResearchLabPage.tsx:205/510-517`、`EdenLabReportPage.tsx:148`、`useEdenLabController.ts` 4 处、`useSources.ts:700/878`
- [ ] SWR effect 内 toast → `onError`（`useSources.ts:166-184`，修后台 revalidate 失败重复弹窗）；顺带修 `useChat.ts:149-174` citationScope 拼 key 串扰
- [ ] lab 自绘 modal 补 `useFocusTrap`（`LabMutationDialogs.tsx`、`ResearchTasksDrawer.tsx`；workspace 已有现成 hook）
- [ ] z-index 双轨收敛：lab 系 21 处 Tailwind `z-10/20/30` → Layer 体系（`ResearchLabPage.tsx:414/606/614-640`、`LabComposePanel.tsx:126`、`DemoResearchLabPage.tsx` 5 处、`WorkspaceTopbarSearch.tsx:251/257`、`CommandPalette.tsx`、`WidgetCatalog.tsx`）
- [ ] （P3 可选）Lab 图谱节点/边键盘可达性：`LabGraph.tsx:125-240`

### W6 · 神文件拆分（P2，行为不变，拆分纪律见根 AGENTS.md）

> 顺序约束：`useEdenLabController` 的结构性改动等 `research-lab-sse-resilience` 落地后再动（该 change 只动 `startStream`）。

- [ ] `useSources.ts`（940 行）→ 五缝：`useSourceTags` / `useExtractors` / `useSourceUploads` / `useSourceSearchQueue` / 引用高亮 hook
- [ ] `WorkspaceLayout.tsx`（984 行）→ 命令面板 builder 独立模块；SourcesPanel/ChatPanel/Overlays 直接消费 store+SWR，砍 45/24/56 props 链；顺带清僵尸 props（`:679-681` 空回调、`searchQueue={[]}`）
- [ ] `LabNodeDrawer.tsx`（857 行）→ `useNodeChat` hook + Meta/Chat 子组件；移除模块级 `chatByNodeId` Map（:34）；fixture 假打字机（:52-65）随 demo 走
- [ ] （P3）server `shared/config.ts`（1033 行，三段拆）与 `run-loop.ts`（968 行，ingest/单元执行/循环三缝）——先消 W3 默认值三写再拆

### W7 · 状态词汇收敛（P3）

- [ ] `ResearchTaskStatus` 字面量四处（`researchTaskTypes.ts:6-13`、`useResearchTasks.ts:13`、`useEdenLabController.ts:65-69`、`demoResearchTasks.ts:9-14`）→ 从 `@crystalith/shared` research schema 派生单一来源；label 映射留 web

### W8 · spec / config 卫生（P2）

- [ ] 删孤儿愿景 spec：`llmanspec/specs/knowledge-curation-and-freshness/`（freshness/duplicate candidates/ignore/re_ingest 全部零实现，grep 已验证；唯一真实存在的 re-embed 归 source-ingestion 系 specs）→ `llman sdd validate --specs --strict` 验收
- [ ] `app.yaml` research 节 camelCase → snake_case（现状违反 `configuration-governance.feature:34` MUST）：改名 + schema 兼容旧键一个过渡期（`.optional()` alias + deprecation 日志），`check-app-schema` 门禁对齐
- [ ] ~~CoachMarkPopover spec 因果补录~~ → 撤销：对应 r281 分层引导条款在实施前已存在（57addb1 < e4510fd），无 spec 增量需求，非欠账

## 3. 排查中排除的嫌疑（勿重复立项）

- 路由 body/query/response 全部挂 shared Zod（params 内联是 Elysia 路径段惯例，非 SSOT 违规）
- SSE 帧格式已统一 `shared/sse-response.ts`；`research-lab-demo/` 是 demo-first 方法论且生产默认关
- 大部分 `catch {}` 为正当降级（presets 容错解析、extractor 兜底、摘要模板兜底等）
- `app.schema.gen.json` 与 config 无漂移；change 归档纪律良好；research 锁/取消竞态设计本身是深思熟虑的
- `errorMessage`/`failureReason` 双字段是有意的旧客户端 wire-compat（带豁免注释）

## 4. 批次纪律提醒

一波一主题 → 实现/锁测 → **`just qa` 全绿** → commit（`fix:`/`refactor:`/`test:`/`doc:`）。
发现需要改 MUST/SHALL → 停，切 `/llman-sdd-propose`。`just qa` 红且无法本波修复 → 停并报告。
