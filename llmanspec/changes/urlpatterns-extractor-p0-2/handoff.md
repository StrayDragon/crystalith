# 交接 Prompt — urlpatterns-extractor-p0-2 实施

> 把下面整段交给实施者（人或 agent）即可。本文件是交付物副本，原文以对话记录为准。
> 交接日期：2026-09-08 · 调研完成度：代码地图已全部踩点，未写任何实现代码。

---

## 任务

在 crystalith 仓库实施 SDD 变更 **`urlpatterns-extractor-p0-2`**（当前处于 draft 阶段，
proposal.md 已就绪）：**URL 导入对话框按粘贴的 URL 自动匹配并预选提取器**。
请走完整 llman SDD 流程：propose（`change start` → design.md + tasks.md → specs
landing → validate）→ apply → verify → archive。

**先读**：`llmanspec/changes/urlpatterns-extractor-p0-2/proposal.md`（方向已获用户确认）
与 `AGENTS.md` 根规范。遇到 proposal 与现实冲突，以复测现实为准并在 design.md 记录偏差。

## 目标体验（交互设计已定稿，用户已确认方向）

1. 仅 **fetch 模式**（「获取内容」）下：用户粘贴 URL 时，前端对提取器元数据里的
   `urlPatterns` 做**本地正则匹配**（不发额外请求）。
2. 命中时在 URL 输入框下方出现推荐行（如「检测到 arXiv 链接，将使用 arXiv 提取器」
   - 可取消勾选的 chip）；**命中项默认预选**；用户可手动增删。
3. **提交语义**：有勾选 → from-url 请求带显式 `extractor` 参数（链路已存在）；
   未勾选/无命中 → `extractor: null` 走既有默认链。
4. **铁律**：`urlPatterns` 只是 UI 预选提示，**MUST NOT 改变服务端提取链的
   fall-through 语义**（见 `web-extractor-plugins` r55）；link 模式不出现任何提取器 UI。

## 代码地图（已踩点，2026-09-08 快照；行号可能漂移，以符号搜索为准）

**服务端**：

- `apps/server/src/plugins/types.ts` — `CrystalithPlugin` 接口：加**可选**
  `urlPatterns?: readonly string[]`（regex **source 字符串**，可序列化过 wire）。
- `packages/plugin-extractor-arxiv/src/index.ts:25` — `ARXIV_ABS_URL`：声明
  `urlPatterns: [ARXIV_ABS_URL.source]`。builtin readability/jina/firecrawl 是通用
  回退，**不声明**。
- `apps/server/src/shared/extraction/factory.ts:26` — `ExtractorMetadata` 接口；
  `:64` `listExtractorMetadata()`：加 `urlPatterns: plugin.urlPatterns ?? null`。
- `apps/server/src/features/sources/router.ts:820` — `GET /v2/notebooks/:nid/extractors`
  响应挂 `ExtractorsListSchema`，元数据加字段后自动透出，路由无需改。
- `apps/server/src/features/sources/from-url.service.ts:53,166` — 已支持显式 extractor：
  `order = extractor ? [extractor] : undefined`，前端提交链路现成。

**Wire schema（packages/shared/src/schemas/source.ts）**：

- `ExtractorInfoSchema`（≈L459）：加 `urlPatterns: z.array(z.string()).nullable().optional()`
  （记得 `desc()` 中文描述，规范见 AGENTS.md i18n 节）。
- ⚠️ **地雷（必须处理）**：from-url body schema `extractor` 字段（≈L337-347）的
  `.refine()` **硬编码白名单 `['readability','jina','firecrawl']`**——直接传 `arxiv`
  会被请求校验拒绝。修法：把 registry 校验下沉到路由业务层（仿照同文件 PATCH
  `/notebooks/:nid/extractors` 用 `extractorNames()` 校验的既有模式），shared schema
  放宽为格式校验（非空小写标识符）。不要在 shared 里做动态 registry 校验（拿不到
  服务端上下文）。

**前端（apps/web/src）**：

- `features/workspace/domains/sources/useSources.ts:704` — `handleAddSourceFromUrl(url,
mode, options?: { extractor })` 已支持 extractor（`:732` 发送 `extractor ?? null`）；
  `:777-799` 已有 extractors 的 SWR hook（key `workspace/extractors`），数据已在
  `WorkspaceLayout` 手里。
- `features/workspace/layout/WorkspaceLayout.tsx:842` — `<AddSourceFromUrlDialog>` 目前
  只传 `open/onClose/onAdd`：**新增传 `extractors`（和 loading）props** 即可，不必新建
  取数。
- `features/workspace/layout/overlays/AddSourceFromUrlDialog.tsx` — 匹配 + 推荐行 UI
  落点；testid 沿用 `TestIds.urlImport*` 体系并新增推荐行 testid（保持既有 testid
  不变，e2e 依赖它们）。
- `ExtractorType = ExtractorInfo['type']`（useSources.ts:22）是泛型 string，前端无
  硬编码清单，无需改类型。

## Specs landing 计划（两条规则，措辞可润色）

1. `llmanspec/specs/web-extractor-plugins/web-extractor-plugins.feature` 新增
   `@req:extractor-url-patterns @human`：extractor 插件 MAY 声明 `urlPatterns`
   （regex source 字符串数组）；系统 SHALL 在 extractors 元数据中透出；urlPatterns
   仅作 UI 预选提示，MUST NOT 改变执行链 fall-through 语义。
2. `llmanspec/specs/workspace-ui-panels/workspace-ui-panels.feature` 新增
   `@req:url-import-extractor-hints @human`：URL 导入对话框 fetch 模式 SHALL 对粘贴
   URL 本地匹配 urlPatterns，命中时呈现推荐提取器并默认预选，用户 MUST 能增删调整；
   未命中或未选择时 MUST 走既有默认链；link 模式 MUST NOT 展示提取器选择。

## 流程硬要求（仓库 SDD 纪律）

- `llman sdd change start urlpatterns-extractor-p0-2`（需 main 干净树）→ 绑定分支上
  编辑 live specs 并 commit（Specs landing）→ `llman sdd validate <id>` 通过后再实现。
- design.md 写权衡（urlPatterns 放插件接口 vs 独立端点；白名单下沉位置）；
  tasks.md 按垂直切片（服务端元数据 → 前端匹配 UI → 测试，各自带验证手段）。
- apply 期间**不逐 task commit**，finalize 收尾单 commit；门禁 `just check` /
  `just test-web` / `just e2e` 全绿；pre-commit 的 oxfmt 自动修复会导致首轮 commit
  失败，重试即可（本会话两次踩到）。
- 验证：匹配逻辑用纯函数单测（正则来自 wire 数据，注意 `new RegExp(pattern)` 的
  try/catch 防御非法 pattern）；e2e @p0 保持全绿（arxiv 正则不会命中 e2e 环境，
  不强求 e2e 覆盖匹配）；最后用一次性 mock gateway + 隔离 DB 起真实 server/web
  做浏览器实测（正则可临时造一个匹配 `http://127.0.0.1:*` 的测试 pattern 验证，
  或造 arxiv URL 走真实网络）。
- 测试 seam：web Vitest（对话框/匹配 hook）+ 既有 e2e @p0；不为匹配逻辑发明新 harness。

## Out of scope

不改 ExtractorPolicyDialog 的策略语义；不动提取器执行链顺序与 fall-through；不做
ExtractorPolicyDialog 与导入对话框的 UI 合并（用户明确保留两者独立，仅在导入对话框
内做轻量推荐行）；不升 Tailwind v4（独立 change `drop-material-tailwind-*` 是前置）。
