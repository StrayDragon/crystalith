# c56 Design — studio config 解读 + workspace config_schema

> SSOT: `backend/py/src/crystalith/features/studio/slides/{config.py,generator.py,schemas.py}` + `shared/plugins/render_types.py` + `shared/agents/generation_preference.py`

## 决策

### D1: config 表 SSOT 放 server 内部，不引入 plugin 层

v1 的 config 表活在 slidev 插件包内（`crystalith-slides-slidev/config.py`），经 `SlidesWorkflowPlugin.config_schema` 暴露。v2 无 plugin host（c13 范围），故将 config 表直接放在 `apps/server/src/features/studio/config.ts`。这是 c13 前的过渡形态——c13 引入 plugin host 后可迁移到 plugin 包，但当前 `buildSlidesConfigSchema()` 的产出形状已对齐 v1 `PluginConfigSchema`，迁移时只需换数据源。

### D2: THEME_PRESETS 逐字移植 v1 6-key 结构

v2 当前 THEME_PRESETS 用单一 `font` 字符串 + 各异的 slidev 主题名（seriph/bricks 等）。v1 恒用 `theme: default` + `colorSchema` + `fonts{sans,serif,mono}` + `background` + `class`。逐字移植 v1 `THEME_PRESET_TEMPLATES`（6 个 preset，每个 6 key）。这是 BREAKING-for-preview（已生成的 preview 主题名会变），但 v1 parity 优先。

### D3: frontmatter override 语义

v1 `_normalize_frontmatter_override`（generator.py:102-115）：`config.frontmatter` 非空字符串（可带 `---` 围栏）→ 清洗后**绕过 preset 整体**用作 frontmatter body（仅在缺 `title:` 且有标题时补一行 title）。`buildFrontmatter(preset, title?, frontmatterOverride?)` 实现此语义。

### D4: preference → retrieval 映射（SLIDES tuning 表）

移植 v1 `generation_preference.py` 的 SLIDES 覆盖（quality→topK:12,minScore:0.1,retries:4,multiQuery:true；speed→topK:6,minScore:0.22；无 preference→用模块常量 DEFAULT_TOP_K=8/DEFAULT_MIN_SCORE=0.2，非 DEFAULT_TUNING 表）。注意 v1 的 subtlety：`preference is None` 时用模块常量(8/0.2)，不是 DEFAULT_TUNING(5/0.2)。

### D5: workspace `/tools/:id/config` 复用 `buildSlidesConfigSchema()`

为满足 r21（一致性），`/tools` 的 SLIDES tool 的 `config_schema` 与 `/tools/slides/config` 的响应**来自同一函数** `buildSlidesConfigSchema()`。形状：`{tool_id, tool_label, ...SlidesConfigSchema}`。

## 涉及文件

### 新增

- `apps/server/src/features/studio/config.ts` — 常量表 + resolve 函数 + buildSlidesConfigSchema
- `apps/server/test/studio/config.test.ts` — 区间展开/frontmatter/options 测试

### 修改

- `packages/shared/src/schemas/studio.ts` — +SlideGenerationConfigSchema +ConfigOption +ThemePresetOption +SlidesConfigSchema
- `apps/server/src/features/studio/theme-presets.ts` — 重写 THEME_PRESETS + buildFrontmatter
- `apps/server/src/features/studio/service.ts` — buildConfigHints/generateOutline/getContext 重写
- `apps/server/src/features/workspace/router.ts` — /tools 加 config_schema；/tools/:id/config 返回完整 schema

### spec delta

- `specs/workspace-api-contract/spec.toon` — MODIFIED r20 + 强化 scenario
- `specs/studio-slides-workflow/spec.toon` — ADDED 2 requirements

## 验证

- `bun test` (server) — 新增 studio config 测试 + 现有 studio/workspace 测试不回归
- `bun typecheck` (server) — ✅
- `bun oxlint` — 0 error
- `llman sdd validate c56-studio-config-and-workspace-schema` — 通过

## 不做

- ❌ 不引入 plugin host（c13）
- ❌ 不改前端（前端消费 config_schema 是后续工作）
- ❌ 不改 outline PUT 的 loose validation（独立 P2）
- ❌ 不补 outline/markdown fallback（独立 P2）
