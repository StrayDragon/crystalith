# c63 Future — 后置项

## studio config_schema 消费

**来源**: c56 在 `workspace/tools` SLIDES tool 加了 `config_schema`（options/defaults，对齐 v1 PluginConfigSchema）。

**现状**: 前端 `useOutputQueue.ts:53-67` 用硬编码 `SlideGenerationConfig`（preference/quantity/audience/structure/tone/language/density/theme_preset/frontmatter）发给 API。`useRefine.ts:141` 的 `normalizeTool` 已读 `tool.config_schema` 但无 UI 渲染。

**目标**: 新建 studio 配置面板组件,从 `workspace/tools` SLIDES tool 的 `config_schema.options` + `config_schema.defaults` 驱动 UI 下拉框/输入,替换硬编码。

**触发条件**: 当需要让用户自定义 slides 配置选项,或当硬编码与 v1 config 表漂移时。

**第一步**: 读 `apps/server/src/features/studio/config.ts` 的 `buildSlidesConfigSchema()` 产出形状,设计前端组件。
