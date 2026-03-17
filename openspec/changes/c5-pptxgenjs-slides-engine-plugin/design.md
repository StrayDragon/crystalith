# c5: Design — PptxGenJS Slides Engine Plugin

## Overview

在现有 `SlidesWorkflowPlugin` 协议基础上，新建 `slides-pptxgenjs` 插件实现 PptxGenJS 引擎。核心设计目标：零外部服务依赖、结构化 slide 数据模型、前端 inline 预览。

## Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│  前端                                                        │
│  ┌────────────────────┐  ┌────────────────────────────────┐  │
│  │ SlidesStudioDialog │  │ SlidePreviewInline             │  │
│  │                    │  │ (preview.service==="pptxgenjs") │  │
│  │ if slidev → iframe │  │ - HTML/CSS 渲染结构化 slides   │  │
│  │ if pptxgenjs ──────┼──▶ - 翻页 / 全屏                  │  │
│  └────────────────────┘  │ - 一键导出 .pptx               │  │
│                          └────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ exporters.ts (增强)                                   │    │
│  │ - 从结构化 slide JSON 生成丰富 PPTX                   │    │
│  │ - 模板系统：配色/字体/布局映射                         │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
                          │ API
┌──────────────────────────────────────────────────────────────┐
│  后端                                                        │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ crystalith-slides-pptxgenjs 插件                      │    │
│  │                                                       │    │
│  │ engine = "pptxgenjs"                                  │    │
│  │ SlidesWorkflowPlugin protocol ✓                       │    │
│  │                                                       │    │
│  │ generate_outline() → SlideOutline (复用核心逻辑)      │    │
│  │ generate_markdown() → 结构化 slide JSON string        │    │
│  │                                                       │    │
│  │ preview_descriptor:                                   │    │
│  │   kind: "inline"                                      │    │
│  │   service: "pptxgenjs"                                │    │
│  │                                                       │    │
│  │ config_schema:                                        │    │
│  │   engine: "pptxgenjs"                                 │    │
│  │   preview: { kind: "inline", service: "pptxgenjs" }   │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ 核心 slides/ (不变)                                    │    │
│  │ - storage.py: write_slide_markdown (存储 markdown 字段)│    │
│  │ - schemas.py: SlideOutline / SlideGenerationConfig     │    │
│  │ - api.py: 转发到活跃插件的 generate_* 方法             │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. 生成目标：结构化 JSON 而非 Slidev Markdown

Slidev 插件让 LLM 生成 Slidev Markdown（含 frontmatter、`---` 分隔符、layout 指令）。PptxGenJS 插件改为让 LLM 生成**结构化 slide JSON**：

```json
{
  "title": "演示标题",
  "slides": [
    {
      "layout": "title",
      "title": "欢迎",
      "subtitle": "副标题"
    },
    {
      "layout": "content",
      "title": "关键发现",
      "bullets": ["发现 1", "发现 2", "发现 3"],
      "notes": "演讲者备注"
    }
  ]
}
```

**理由**：
- 结构化数据对 PptxGenJS 更友好——直接映射到 `addSlide()` / `addText()` 调用
- 避免 markdown 解析的脆弱性（当前 `parseSlidesFromMarkdown` 正则解析容易丢失信息）
- 向前兼容：未来可扩展更多布局类型（双栏、图文混排）

**存储**：仍使用 DB 的 `markdown` 字段存储 JSON 字符串——字段名不准确但避免迁移。

### 2. PreviewDescriptor 扩展：新增 `kind="inline"`

当前 `PreviewDescriptor.kind` 仅支持 `"external_url"`。新增 `"inline"` 值：

```python
# render_types.py
class PreviewDescriptor(BaseModel):
    kind: Literal["external_url", "inline"]
    service: str
    meta: dict[str, str] | None = None
```

前端 `SlidesStudioDialog` 分支逻辑：
- `kind === "external_url"` → 现有 iframe 行为
- `kind === "inline"` → 渲染 `SlidePreviewInline` 组件

### 3. 前端 Inline 预览组件

新增 `frontend/web/src/features/workspace/domains/studio/SlidePreviewInline.tsx`：

- 接收结构化 slide JSON 数据
- HTML/CSS 渲染（卡片式 slide 预览，非真实 PPTX 渲染）
- 支持：翻页导航、全屏模式、当前页指示器
- 样式与 PptxGenJS 导出模板保持一致（所见即所得）
- 不依赖任何外部服务

### 4. 后端插件结构

```
backend/py/plugins/crystalith-slides-pptxgenjs/
├── pyproject.toml
├── src/
│   └── crystalith_slides_pptxgenjs/
│       ├── __init__.py
│       ├── plugin.py          # SlidesWorkflowPlugin 实现
│       ├── generator.py       # LLM prompt + 结构化 JSON 生成
│       └── config.py          # 引擎特定配置/模板
└── tests/
    └── test_generator.py
```

Entry point: `slides-pptxgenjs = crystalith_slides_pptxgenjs.plugin:plugin`

### 5. 引擎选择与并存

- `config/app.yaml` → `slides.default_plugin: "slides-pptxgenjs"` 或 `"slides-slidev"`
- 两个插件可同时安装；核心根据 config 选择活跃插件
- DB `engine` 字段记录每个 draft 使用的引擎，确保已有 draft 仍由正确引擎处理
- 前端从 `/v1/workspace/tools` 获取活跃插件的 `preview_descriptor`，无硬编码

### 6. 增强的 PPTX 导出

当前 `exportPptx()` 仅输出标题 + 纯文本。增强为：

- 从结构化 slide JSON 直接生成（不再经过 `parseSlidesFromMarkdown`）
- 模板系统：预设配色方案、字体组合、标题页/内容页不同布局
- 要点使用 PptxGenJS bullet API（非手工拼 `• ` 前缀）

### 7. 向后兼容

- `parseSlidesFromMarkdown` 保留——用于 Slidev 引擎的 PPTX 导出
- `buildSlidesExportItems` 增加引擎判断：
  - `engine === "pptxgenjs"` → 直接解析结构化 JSON
  - `engine === "slidev"` → 走现有 markdown 解析路径
- 所有 Slidev 相关代码/服务不受影响

## Migration & Rollback

- **无数据库迁移**：`engine` 字段已存在，新值 `"pptxgenjs"` 无需 ALTER
- **回滚**：移除 `slides-pptxgenjs` 插件包 + 配置恢复 `slides-slidev` 即可
- **并存期间**：两个引擎的 draft 互不干扰，`engine` 字段区分

## Open Questions

1. **LLM 输出验证**：结构化 JSON 生成是否需要 Pydantic output schema 校验？（建议：是，定义 `SlideSpec` model）
2. **预览保真度**：HTML 预览与 PPTX 导出之间的样式一致性如何保证？（建议：共享 theme token 定义）
3. **演讲者备注**：第一期是否支持 `notes` 字段？（建议：数据模型包含，UI/导出第一期可忽略）
