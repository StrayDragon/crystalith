# Roadmap — 主线路线规划

> 2026-09-07 整理。上游事实源：`AGENTS.md`（现状）、`llmanspec/changes/`（活跃=仅 plugin-interface-ssot draft）、`llmanspec/specs/`（30 能力域）、`docs/opensource-checklist.md`（开源线）。
> 状态标记：✅ 完成 · 🔜 待启动 · ⏸️ 阻塞/待拍板 · 🔄 持续。

## 总览

| 线  | 主题                   | 状态                                                                            |
| --- | ---------------------- | ------------------------------------------------------------------------------- |
| A   | 开源发布               | 🔜 README 已完成（2026-09-09）；剩 CONTRIBUTING/SECURITY/CHANGELOG + 发布日清理 |
| B   | 分发 + 插件架构（c13） | 🚧 v1（web 模式单二进制）管线已落地；跨平台矩阵 + 正式化待续                    |
| C   | 产品深化               | 🔜 本文细化                                                                     |
| D   | 工程债                 | 🔜 本文细化                                                                     |

**关键路径**：A 收尾 → c13 跨平台发布 → B 立项 → C/D 按需穿插。

---

## B 线：c13 分发 + 插件架构（分叉点）

> **2026-09-09 进展**：c13 v1 的本地管线已提前落地——`apps/server/scripts/build-binary.ts`
> （css-tree JSON 内联插件 + tag 版本注入）、server 静态托管（`CL_WEB_DIST` / 二进制旁
> `web/dist`，SPA fallback，API 404 语义保持）、`just release` 产物
> （二进制 + web/dist + drizzle + native/vec0 + config）。剩余：tag 发布 + CI 矩阵
> 构建（macOS/Linux/Windows 冒烟）、`ship-server-binary` 走 SDD 正式化归档。

### 倾向（2026-09-07，待 propose 正式化）

1. **分发形态**：二进制方向。产物矩阵 = `crystalith-server` 单二进制（bun compile，headless/自托管/Docker 的必要内核）+ `Crystalith` 桌面应用（Tauri v2，sidecar 内嵌 server 二进制 + 静态 web 资源）。**server 是唯一内核；app 是可选分发壳**。
2. **插件分发**：**npm 优先**（理由见下）。

### ✅ 已拍板（2026-09-08 确认）

- **首版（c13 v1）只做 web 模式的 server 单二进制**：API + 静态 web 资源一个二进制交付；headless 优先——**裸 CLI/TUI 用户与第三方 client 直接对接 server HTTP API 是一等场景**
- **Tauri 桌面端 delay**：不进首版；待 web 单二进制形态稳定后另起 change（sidecar 内嵌 server）
- **插件分发 = npm**："npm 依赖 + 重启加载"，不搞运行时热插拔；官方插件内嵌为 built-in 实现并同时发 npm 样例
- 落地变更：`plugin-interface-ssot`（接口 SSOT，转正式 propose）+ `ship-server-binary`（c13 v1 分发，proposal/design 就绪，实施排在 A 线收尾后）

### npm 优于内嵌的理由

- 分发/版本/依赖解析免费获得；内嵌方案每加一个插件都要重编译整包，与"插件"语义矛盾
- Bun 原生支持运行时加载 node_modules → 首版形态可以是 **"npm 依赖 + 重启加载"**：不搞运行时热插拔（与 plugin-interface-ssot 草案的非目标一致），安装 = 加依赖 + 重启 server
- 官方插件双轨：内嵌为 built-in 实现（studio config 表、extractor factory 迁移产物），同时发 npm 作为外部接入样例
- 风险与对策：供应链安全 → scope 约定（`@crystalith-plugin/*`）+ config 显式启用清单；跨平台 native 依赖 → 插件约定纯 JS（Zod configSchema + factory），禁止 native addon
- ⚠️ 草案修订点：`plugin-interface-ssot` 非目标写的是"首版仅支持编译期内置"，定 npm 后正式化时需改为"npm 依赖 + 重启加载"

### B 立项后的顺序（草案已有方向）

1. `CrystalithPlugin` 接口 SSOT（id / kind / configSchema / factory / 能力声明）
2. studio config 表、extractor factory 迁移为两个内置实现（行为不变，wire 不变）
3. `/v2/workspace/tools` diagnostics official catalog 由接口清单驱动（r18 已预留形态）
4. Tauri 壳 + sidecar 打包（依赖 1-3 冻结接口后并行）

---

## C 线：产品深化（细化）

排序原则：spec 已就绪 > 能力跃迁 > 锦上添花；每项走 `cl-prd-demo`（demo 锁 UX → gap 清点 → Eden wire-up）或 llman propose。

### C1 知识治理产品化 🔜（建议首发）

- 依据：`knowledge-curation-and-freshness` spec 已定义完整信号模型（freshness / duplicate candidates / maintenance suggestions）与显式动作（ignore / re_ingest / re_embed / review），只差产品面
- 交付物：workspace 治理面板（知识库健康度视图 + 一键 re-ingest / re-embed 队列 + duplicate 审阅流）
- 价值：**"长期知识库不劣化"是这个产品的差异化叙事**，且后端信号已在 spec 层锁定

### C2 QA Agent 化（r118）🔜

- 现状：QA 是"检索一次 + 单轮生成"；深研节点环已用 ToolLoopAgent（经验可平移）
- 交付物：QA 按需多轮取证（组合 retrieve / searchWeb 工具，streamText + maxSteps）
- 边界：必须保持 citation 语义与 `source_mode` 一致性（source-aware-generation-modes spec），工具轨迹可解释

### C3 Deep Research 持续迭代 🔄

- 产品面已闭环；不做凭空功能规划，按 cl-prd-demo 由真实使用反馈逐个上（候选池：run 对比/历史管理、报告导出扩展、失败恢复 UX、预算可视化）

### C4 Connectors 官方目录扩展 🔜（中期）

- 宿主语义已固化（发现 / notebook-scoped binding / 快照优先 / sync_check）
- 先扩官方 connector 数量；**第三方 connector 分发依赖 B 线插件机制**，顺序上排在 c13 之后

### C5 跨类型转换扩展 🔄（按需）

- `cross-type-result-transformations` 已有 lineage 安全模型（保留/重建 + 回退重新生成）
- 每次扩一对转换路径都走该纪律；不做"万物互转"

### C6 Studio 输出类型深化 🔜（按需）

- 六类型（briefing/guide/flashcard/mindmap/quiz/timeline）已有最小交互基线；候选：导出能力对齐、slides 官方插件样板推广到其他类型

### C7 RAG 策略扩展 ⏸️（等痛点数据）

- GraphRAG / HyDE / Self-RAG 维持 deferred；触发条件：检索质量的真实负反馈
- 注意：c73 已删除过 Eval Harness（无 consumer）；重建前必须先定义 consumer（CI 门禁 or CLI），避免重蹈覆辙

---

## D 线：工程债（细化）

### D1 type-aware lint 债清偿 🔜（小而明确，建议先做）

- 现状：**29 warnings + 2 errors**（355 files）；`typescript/prefer-readonly-parameter-types` 全局关闭保持不变
- 目标：清零后把 `just type-aware-lint` 从 advisory 升级进 `just qa` 门禁（quality-and-regression spec 同步）

### D2 e2e @p1 扩面 🔜

- 现状：@p0 31 条全绿，**@p1 仅 p1-sources 2 条**——重构保护网明显偏薄
- 候选面（按价值）：chat QA 流（mock 网关）→ studio 输出类型冒烟 → research lab @p1（reexpand/skip 已有 p0 覆盖，可补编辑/取消路径）→ connectors
- 铁律：全部走 `mock-openai-gateway` + `CL_RESEARCH_E2E_STUB`，不依赖真实模型

### D3 BDD 覆盖扩展 🔜（增量）

- 现状 SKIP 5 域：`commands`（缺 preset 数据）、`models`（缺 config fixture）——**这两个不依赖 LLM，补 fixture 即可解锁**；`outputs`/`qa`/`research` 需要 mock LLM 层（可复用 e2e 的 mock 网关思路）
- 顺序：models → commands → （评估后）LLM 三域

### D4 上游跟踪 🔄（例行）

- Elysia 单字符 host 404：升级 Elysia 时跑既有探针（`http://test.local` 基址）
- Bun 进程组怪癖：仅影响 dev 体验，`setsid nohup` 已记录缓解
- TS7/tsgo 守则：大版本升级后冒烟所有 codegen script（`just gen-all`、db:generate）

### D5 依赖升级纪律 🔄（例行）

- Bun 升级：sqlite-vec / unpdf / `bun:sqlite` 冒烟（just test + just e2e 即覆盖大半）
- provider 包升级：`check-provider-deps` 门禁已在

---

## A 线（照旧，指针）

见 `docs/opensource-checklist.md`：剩 README + CONTRIBUTING/SECURITY(r97)/CHANGELOG 批次、发布日内部机制移出、开源后接 CI。
