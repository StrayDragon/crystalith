## Context

- 演示工具采用输入 → 大纲 → Markdown 的三阶段流程，需要手动触发生成。
- Studio 卡片的一键生成体验目前不覆盖演示。
- 演示生成的参数无法持久化或影响 LLM prompt，主题与 frontmatter 也缺少统一生成策略。

## Goals / Non-Goals

Goals:
- 保持三阶段流程与可编辑能力，同时提供演示一键生成入口。
- 为演示提供可配置参数，并持久化到草稿以驱动 LLM 生成。
- 让主题预设与 frontmatter 可自动生成并支持手动覆盖。
- 默认值清晰、配置可回填，避免破坏既有流程。

Non-Goals:
- 替换 Slidev 或引入新的渲染引擎。
- WYSIWYG 编辑器或主题市场。
- 全量重构 Studio 的通用配置框架。

## Decisions

- 在 StudioSlide 中新增 generation_config（JSON），作为演示生成的唯一参数来源。
- 一键生成通过前端串联现有 outline/markdown SSE：先生成大纲，再自动生成 Markdown。
- 演示配置放在演示流程内（输入阶段的设置区），卡片配置入口直接打开演示设置。
- 生成 prompt 由后端组装，明确映射数量范围、结构模板与语气风格等约束。
- 主题预设从配置中选择，映射到可控的 frontmatter 模板。
- frontmatter 由后端在 Markdown 生成阶段自动补全；若用户手动覆盖则以手动为准。

## Theme Presets (Draft)

说明：主题预设以 `theme_preset` 标识选择，生成时映射到 frontmatter 模板。以下模板为示例，字段以 Slidev 支持范围为准，实际实现需校验与兜底。

### Preset: 清爽极简 (theme_preset: minimal-clean)

适用：课堂/知识说明、内部培训。

示例 frontmatter:
```yaml
---
theme: default
colorSchema: light
fonts:
  sans: "Manrope"
  serif: "Noto Serif SC"
  mono: "Fira Code"
transition: fade
background: "#F8FAFC"
class: "text-left"
---
```

### Preset: 商务汇报 (theme_preset: business-brief)

适用：管理层汇报、项目复盘、决策沟通。

示例 frontmatter:
```yaml
---
theme: default
colorSchema: light
fonts:
  sans: "IBM Plex Sans"
  serif: "Noto Serif SC"
  mono: "JetBrains Mono"
transition: slide-left
background: "linear-gradient(180deg, #F8FAFC 0%, #EEF2FF 100%)"
class: "text-left"
---
```

### Preset: 产品发布 (theme_preset: product-launch)

适用：发布会、增长宣讲、对外演示。

示例 frontmatter:
```yaml
---
theme: default
colorSchema: light
fonts:
  sans: "Space Grotesk"
  serif: "Noto Serif SC"
  mono: "Fira Code"
transition: fade-out
background: "radial-gradient(circle at 20% 20%, #FDE68A 0%, #FFFFFF 45%, #EEF2FF 100%)"
class: "text-center"
---
```

### Preset: 学术研究 (theme_preset: research-paper)

适用：论文汇报、学术研讨、研究复盘。

示例 frontmatter:
```yaml
---
theme: default
colorSchema: light
fonts:
  sans: "Source Sans 3"
  serif: "Source Serif 4"
  mono: "Source Code Pro"
transition: slide-up
background: "#FFFBF5"
class: "text-left"
---
```

### Preset: 数据洞察 (theme_preset: data-insight)

适用：数据分析、指标复盘、图表密集型演示。

示例 frontmatter:
```yaml
---
theme: default
colorSchema: light
fonts:
  sans: "Inter"
  serif: "Noto Serif SC"
  mono: "JetBrains Mono"
transition: slide-right
background: "repeating-linear-gradient(0deg, #F8FAFC 0px, #F8FAFC 24px, #E5E7EB 25px)"
class: "text-left"
---
```

### Preset: 创意视觉 (theme_preset: creative-visual)

适用：品牌故事、创意提案、视觉表达。

示例 frontmatter:
```yaml
---
theme: default
colorSchema: dark
fonts:
  sans: "Bebas Neue"
  serif: "Noto Serif SC"
  mono: "Fira Code"
transition: zoom
background: "linear-gradient(135deg, #0F172A 0%, #111827 50%, #1F2937 100%)"
class: "text-white text-left"
---
```

## Alternatives considered

- 新增后端“一键生成” SSE 端点：复杂度更高，先用前端串联现有端点。
- 复用 outputs API 生成 SLIDES：已被限制且与演示三阶段流程不匹配。

## Risks / Trade-offs

- 参数增多会增加 UI 复杂度 → 使用默认值与可折叠的高级设置。
- 串联 SSE 增加等待时间 → 通过进度事件区分阶段并提供重试。

## Migration Plan

- generation_config 字段可为空，读取时回填默认值。
- 旧草稿不会触发破坏性迁移。

## Open Questions

- 是否需要在后续版本引入主题模板的“推荐逻辑”（按内容类型/受众自动推荐）。
