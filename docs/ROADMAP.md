# Roadmap

> 状态标记：✅ 完成 · 🔜 待启动 · ⏸️ 暂缓 · 🔄 持续。现状事实源见 [AGENTS.md](../AGENTS.md)。

## 总览

| 线  | 主题            | 状态                                                             |
| --- | --------------- | ---------------------------------------------------------------- |
| A   | 开源发布        | ✅ README / CI / Release 管线 / 开源清理均已完成（2026-09-09）   |
| B   | 分发 + 插件架构 | 🚧 v1（web 模式单二进制）已首发；跨平台矩阵 + 插件接口正式化待续 |
| C   | 产品深化        | 🔜 见下文                                                        |
| D   | 工程债          | 🔜 见下文                                                        |

**关键路径**：c13 跨平台发布 → B 线立项 → C/D 按需穿插。

---

## B 线：分发 + 插件架构（c13）

> **进展**：c13 v1 已随 `v2.0.0-pre` 首发——linux-x64/arm64 原生构建 + 冒烟 +
> GitHub Release 自动化；darwin/win32 暂缓（Bun 上游 SQLite 扩展限制，
> 见 [known-issues.md](known-issues.md)）。

### 已定方向

- **分发形态**：二进制方向。产物矩阵 = `crystalith-server` 单二进制（headless / 自托管 / Docker 的必要内核）+ 桌面应用（Tauri v2，sidecar 内嵌 server 二进制 + 静态 web 资源）。**server 是唯一内核；app 是可选分发壳**。
- **首版（已落地）只做 web 模式的 server 单二进制**：API + 静态 web 资源一个二进制交付；headless 优先——裸 CLI/TUI 用户与第三方 client 直接对接 server HTTP API 是一等场景。
- **Tauri 桌面端暂缓**：待 web 单二进制形态稳定后另行立项。
- **插件分发 = npm**："npm 依赖 + 重启加载"，不搞运行时热插拔；官方插件内嵌为 built-in 实现并同时发 npm 样例。

### npm 优于内嵌的理由

- 分发/版本/依赖解析免费获得；内嵌方案每加一个插件都要重编译整包，与"插件"语义矛盾
- Bun 原生支持运行时加载 node_modules → 安装 = 加依赖 + 重启 server
- 官方插件双轨：内嵌为 built-in 实现，同时发 npm 作为外部接入样例
- 风险与对策：供应链安全 → scope 约定（`@crystalith-plugin/*`）+ config 显式启用清单；跨平台 native 依赖 → 插件约定纯 JS（Zod configSchema + factory），禁止 native addon

### B 线后续顺序

1. `CrystalithPlugin` 接口 SSOT 正式化（id / kind / configSchema / factory / 能力声明）
2. studio config 表、extractor factory 迁移为两个内置实现（行为不变，wire 不变）
3. `/v2/workspace/tools` diagnostics official catalog 由接口清单驱动
4. Tauri 壳 + sidecar 打包（依赖 1-3 冻结接口后并行）

---

## C 线：产品深化

排序原则：行为契约已就绪 > 能力跃迁 > 锦上添花；新表面先做可运行的 demo 锁定 UX，再接真实 API。

### C1 知识治理产品化 🔜（建议首发）

- 知识新鲜度 / 重复候选 / 维护建议的信号模型已在后端就绪，只差产品面
- 交付物：workspace 治理面板（知识库健康度视图 + 一键 re-ingest / re-embed 队列 + duplicate 审阅流）
- 价值：**"长期知识库不劣化"是这个产品的差异化叙事**

### C2 QA Agent 化 🔜

- 现状：QA 是"检索一次 + 单轮生成"；深研节点环已用 ToolLoopAgent（经验可平移）
- 交付物：QA 按需多轮取证（组合 retrieve / searchWeb 工具，streamText + maxSteps）
- 边界：必须保持 citation 语义与 `source_mode` 一致性，工具轨迹可解释

### C3 Deep Research 持续迭代 🔄

- 产品面已闭环；不做凭空功能规划，按真实使用反馈逐个上（候选池：run 对比/历史管理、报告导出扩展、失败恢复 UX、预算可视化）

### C4 Connectors 官方目录扩展 🔜（中期）

- 宿主语义已固化（发现 / notebook-scoped binding / 快照优先 / sync_check）
- 先扩官方 connector 数量；**第三方 connector 分发依赖 B 线插件机制**，顺序上排在 c13 之后

### C5 跨类型转换扩展 🔄（按需）

- 跨类型输出转换已有 lineage 安全模型（保留/重建 + 回退重新生成）；每次扩一对转换路径都走该纪律，不做"万物互转"

### C6 Studio 输出类型深化 🔜（按需）

- 六类型（briefing/guide/flashcard/mindmap/quiz/timeline）已有最小交互基线；候选：导出能力对齐、slides 官方插件样板推广到其他类型

### C7 RAG 策略扩展 ⏸️（等痛点数据）

- GraphRAG / HyDE / Self-RAG 维持 deferred；触发条件：检索质量的真实负反馈
- 注意：曾删除过无 consumer 的 Eval Harness；重建前必须先定义 consumer（CI 门禁 or CLI）

---

## D 线：工程债

### D1 type-aware lint 债清偿 🔜（小而明确，建议先做）

- 目标：清零 advisory warnings 后把 `just type-aware-lint` 升级进 `just qa` 门禁
- `typescript/prefer-readonly-parameter-types` 全局关闭保持不变（回调签名不可控）

### D2 e2e @p1 扩面 🔜

- 现状：@p0 全绿；@p1 仅 sources 2 条——重构保护网偏薄
- 候选面（按价值）：chat QA 流（mock 网关）→ studio 输出类型冒烟 → research lab 编辑/取消路径 → connectors
- 铁律：全部走 mock 网关，不依赖真实模型

### D3 BDD 覆盖扩展 🔜（增量）

- 部分 BDD 域因缺 fixture / mock LLM 层暂跳过；顺序：补 config fixture 域 → 命令域 → 评估后 LLM 三域

### D4 上游跟踪 🔄（例行）

- Elysia / Bun / TS 大版本升级纪律与已知怪癖台账见 [known-issues.md](known-issues.md)

### D5 依赖升级纪律 🔄（例行）

- Bun 升级：sqlite-vec / unpdf / `bun:sqlite` 冒烟（just test + just e2e 即覆盖大半）
- provider 包升级：`check-provider-deps` 门禁已在
