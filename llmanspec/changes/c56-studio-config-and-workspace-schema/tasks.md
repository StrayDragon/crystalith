# c56 Tasks

## 1. shared schemas (packages/shared)

- [x] 1.1 `packages/shared/src/schemas/studio.ts`: 新增 `SlideGenerationConfigSchema`（preference?:'quality'|'speed', quantity?, audience?, structure?, tone?, language?, density?, theme_preset?, frontmatter?）
- [x] 1.2 新增 `ConfigOptionSchema` {id, label, is_default}、`ThemePresetOptionSchema` {id, label, template}、`SlidesConfigSchemaSchema`（defaults + 7 options + engine + preview）
- [x] 1.3 从 index.ts 导出新 schemas (via existing `export * from './studio.js'`)
- [x] 1.4 `bun typecheck` (server) 通过

## 2. studio config 表 SSOT (apps/server)

- [x] 2.1 新建 `apps/server/src/features/studio/config.ts`：移植 v1 config.py 常量表（QUANTITY_RANGES, DENSITY_BULLETS, STRUCTURE_TEMPLATES, AUDIENCE_HINTS, TONE_HINTS, LANGUAGE_HINTS, DEFAULT_CONFIG, 7 个 *_OPTIONS 列表，THEME_PRESET_TEMPLATES）
- [x] 2.2 实现 resolve 帮助函数（resolveQuantityRange/resolveBulletRange/resolveStructureHint 等，fallback 到 standard）
- [x] 2.3 实现 `buildSlidesConfigSchema()` 返回完整 SlidesConfigSchema（对齐 v1 PluginConfigSchema）

## 3. theme-presets 重写

- [x] 3.1 `apps/server/src/features/studio/theme-presets.ts`：THEME_PRESETS 改用 v1 6-key 结构（逐字移植 THEME_PRESET_TEMPLATES）
- [x] 3.2 `buildFrontmatter(preset, title?, frontmatterOverride?)`：支持 override 绕过 preset + title 注入 + `---\n{body}\n---\n\n{md}` 包装

## 4. service.ts config 解读

- [x] 4.1 `buildConfigHints(config)`：移植 v1 requirement_lines（中文 + 区间展开 + 条件 hints）
- [x] 4.2 `generateOutline(slide, context)`：接入 buildConfigHints(slide.generationConfig)
- [x] 4.3 `getContext(slide)`：读 preference 映射 topK/minScore（quality→12/0.1, speed→6/0.22, 无→8/0.2）

## 5. workspace router 契约落地

- [x] 5.1 `/workspace/tools` SLIDES tool 对象加 `config_schema: buildSlidesConfigSchema()`
- [x] 5.2 `/workspace/tools/:id/config` 返回 `{tool_id, tool_label, ...buildSlidesConfigSchema()}`

## 6. 测试

- [x] 6.1 新建 `test/studio/config.test.ts`：区间展开（detailed→12-18）、frontmatter 6-key、override 路径、preference→retrieval 映射 (23 tests)
- [x] 6.2 扩展 workspace 测试：SLIDES tool 含 config_schema（现有 workspace 测试通过 + config.test.ts 覆盖 buildSlidesConfigSchema 完整性）

## 7. spec + 验证

- [x] 7.1 `llman sdd validate c56-studio-config-and-workspace-schema` 通过
- [x] 7.2 `bun test` (server) 通过（257 pass / 0 fail，+23 新测试）
- [x] 7.3 `bun typecheck` (server) ✅
- [x] 7.4 `bun oxlint` 0 error
