---
depends_on: []
batch: all
---

# c56-studio-config-and-workspace-schema — studio generation_config 真实解读 + workspace config_schema 契约落地

## Why

2026-07-13 v1↔v2 差距深度审计发现 studio (slides) 域存在 3 个关联的实质偏离（P1-3/4/5），且 workspace 端点违反既有契约 MUST。本 change 一次性对齐 studio 配置解读链路与 workspace config_schema 契约。

### Spec 已要求（MUST，当前违反）

- `workspace-api-contract r20` —— "`/v1/workspace/tools` 返回的工具对象 MUST 包含可直接驱动 UI 的 `config_schema`（如支持主题、数量/难度选项与默认值）。对于 `SLIDES`，该 `config_schema` MUST 覆盖 defaults、quantity / audience / structure / tone / language / density / theme / frontmatter，以及 active plugin 声明的 engine / preview 相关元数据；客户端 MUST NOT 依赖独立 slides config 端点"
- `workspace-api-contract r21` —— "若 `/v1/workspace/tools/{tool_id}/config` 端点存在，其返回值 MUST 与 tools 列表中的 `config_schema` 语义一致"
- scenario `r20 slides-config-is-derived-from-tools-response-only` —— "客户端请求 `/v1/workspace/tools`，`SLIDES` tool（若存在） SHALL 在其 `config_schema` 中返回完整配置语义"

### 实现违反

1. **workspace `/tools` 不返回 config_schema**：`apps/server/src/features/workspace/router.ts` 的 tool 对象只有 `{id, kind, label, description, tone, output_type, prompt, is_tool, enabled}`，无 `config_schema` 字段。
2. **workspace `/tools/:id/config` 返回形状错误**：只返回 `{tool_id, tool_label, type, prompt}`，无 options 列表，违反 r21。
3. **studio `buildConfigHints` 形同未解读**（`apps/server/src/features/studio/service.ts:53-63`）：`quantity` 分支检查 `typeof === 'number'` 但 schema 用字符串 id，是死代码；其他分支直接拼原始 token（`Tone: professional.`），不做区间展开。
4. **`generateOutline` 完全不读 `generationConfig`**（service.ts:195-212）。
5. **THEME_PRESETS 字段全面偏离 v1**（`theme-presets.ts`）：theme 名不同、缺 `colorSchema`/`class`/serif/mono fonts、无 override 路径。
6. **`getContext` 忽略 `preference`**（service.ts:78-80）：硬编码 `topK: 20`，不读 quality/speed 调优。

### v1 参考（正确行为）

- `backend/py/.../studio/slides/config.py`（195 行）：`QUANTITY_RANGES`、`DENSITY_BULLETS`、`STRUCTURE_TEMPLATES`、`AUDIENCE_HINTS`、`TONE_HINTS`、`LANGUAGE_HINTS`、`THEME_PRESET_TEMPLATES`、7 个 `*_OPTIONS` 列表。
- `backend/py/.../studio/slides/generator.py:202-290`：`_build_outline_prompt`/`_build_markdown_prompt` 用中文 requirement_lines + 区间展开 + 条件 hints。
- `backend/py/.../studio/slides/generator.py:378-387,499-507`：`preference` → `tuning_for_request(SLIDES, ...)` → topK/minScore/agent_retries。
- `backend/py/.../workspace/api.py` + `shared/plugins/render_types.py`：`PluginConfigSchema`（defaults + 7 options + engine + preview）经 `/tools` 与 `/tools/:id/config` 暴露。

## What Changes

1. **`packages/shared/src/schemas/studio.ts`** — 新增 Zod schemas：`SlideGenerationConfigSchema`（preference/quantity/audience/structure/tone/language/density/theme_preset/frontmatter）、`ConfigOptionSchema`、`ThemePresetOptionSchema`、`SlidesConfigSchemaSchema`（PluginConfigSchema 等价）。
2. **`apps/server/src/features/studio/config.ts`**（新文件）— 移植 v1 config.py：常量表 + resolve 帮助函数 + `buildSlidesConfigSchema()` 返回完整 options+defaults。
3. **`apps/server/src/features/studio/theme-presets.ts`**（重写）— THEME_PRESETS 改用 v1 6-key 结构（theme 恒 default + fonts{sans,serif,mono} + colorSchema + transition + background + class）；`buildFrontmatter` 支持 override + title + 正确包装。
4. **`apps/server/src/features/studio/service.ts`**（重写关键函数）— `buildConfigHints` 移植 v1 requirement_lines；`generateOutline` 接入 config hints；`getContext` 读 preference 映射 topK/minScore。
5. **`apps/server/src/features/workspace/router.ts`**（契约改动）— `/tools` tool 对象加 `config_schema`（SLIDES 返回 `buildSlidesConfigSchema()`）；`/tools/:id/config` 返回完整 config_schema。
6. **测试** — 新增 `test/studio/config.test.ts`（区间展开/frontmatter 6-key/options 完整性）+ 扩展 workspace 测试。

## Capabilities

- `workspace-api-contract` —— MODIFIED r20（细化 config_schema 实际产出要求）+ 强化 r20 scenario
- `studio-slides-workflow` —— ADDED 2 requirements（generation_config MUST 区间展开；frontmatter MUST 含 v1 6 字段集 + override）

## Impact

- **BREAKING**（workspace `/tools/:id/config` 响应 shape 扩展）：旧客户端若依赖该端点只返回 `{tool_id,tool_label,type,prompt}`，需适配新增的 options/defaults 字段。前端尚未消费此端点的 options（PROGRESS 记录前端下拉框暂不可用），故实际影响有限。
- **用户可见改进**：slides 生成尊重 quantity/density/audience/tone/structure/language/theme 选择；frontmatter 渲染样式与 v1 一致；preference (quality/speed) 调优检索。
- **代码量**：+1 新文件 config.ts (~180 行) + theme-presets 重写 (~100 行) + service.ts 局部重写 + workspace router 改造 + shared schemas (~60 行)。
- **风险**：中。frontmatter 主题名变化（v2 原 seriph/bricks → v1 default）可能影响已生成但未重新生成的 preview；生成 prompt 变化可能微调输出质量。
- **依赖**：与已提交的 5 个 quick fix 独立；不阻塞 c13/c14。
