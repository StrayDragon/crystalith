# slides-workflow-plugins — Delta Spec (c5)

## MODIFIED

### Requirement: Repository provides an official reference slides plugin

**变更**：将 "official reference plugin" 从单一 `slides-slidev` 扩展为包含 `slides-pptxgenjs` 的双引擎参考实现。

仓库 MUST 提供至少两个官方 reference plugin，作为不同预览模式（外部服务 vs 内建渲染）的样板：

- `slides-slidev`（现有）：`preview_descriptor.kind = "external_url"`，依赖外部 Slidev 服务
- `slides-pptxgenjs`（新增）：`preview_descriptor.kind = "inline"`，纯前端渲染，零服务依赖

两者均 MUST：

- 实现 `SlidesWorkflowPlugin` protocol 的完整子集
- 暴露 rich `config_schema`、preview contract 与 frontend bundle metadata
- 通过 `runtime_checkable` 验证

#### Scenario: PptxGenJS plugin exposes slides capability without external service
- **WHEN** 运维安装并启用 `slides-pptxgenjs` plugin 且未部署 Slidev 服务
- **THEN** `/v1/workspace/tools` SHALL 暴露 `SLIDES` tool with `engine = "pptxgenjs"`
- **AND** `preview_descriptor` SHALL 声明 `kind = "inline"`, `service = "pptxgenjs"`
- **AND** UI SHALL 使用 inline 预览组件渲染幻灯片，而非 iframe

#### Scenario: Switching between engines preserves existing drafts
- **WHEN** 用户从 `slides-slidev` 切换到 `slides-pptxgenjs`（或反向）
- **THEN** 已有 draft 的 `engine` 字段 SHALL 保持不变
- **AND** 新 draft SHALL 使用当前 active plugin 的 engine 值
- **AND** 不同 engine 的 draft 在 UI 中 SHALL 标注其 engine 类型

## ADDED

### Requirement: PreviewDescriptor supports inline rendering mode

`PreviewDescriptor.kind` MUST 支持 `"inline"` 值，表示预览由前端内建组件渲染，无需外部服务。

当 `kind = "inline"` 时：
- 前端 MUST 渲染引擎特定的 inline 预览组件
- 前端 MUST NOT 尝试加载外部 URL 或创建 iframe
- `service` 字段用于标识渲染器（如 `"pptxgenjs"`），前端据此选择预览组件

#### Scenario: Inline preview renders without network dependency
- **WHEN** active slides plugin 声明 `preview_descriptor.kind = "inline"`
- **THEN** SlidesStudioDialog SHALL 渲染 inline 预览组件
- **AND** 预览 SHALL 在无网络连接时仍可用（纯客户端渲染）

### Requirement: PptxGenJS plugin generates structured slide data

`slides-pptxgenjs` 插件的 `generate_markdown()` MUST 返回结构化 slide JSON（而非 Slidev Markdown）。

JSON schema MUST 至少包含：
- `title: string` — 演示标题
- `slides: SlideItem[]` — 幻灯片列表

每个 `SlideItem` MUST 至少包含：
- `layout: "title" | "content"` — 布局类型
- `title: string` — 幻灯片标题

按 layout 类型：
- `"title"` layout MAY 包含 `subtitle: string`
- `"content"` layout MAY 包含 `bullets: string[]` 和/或 `paragraphs: string[]`

#### Scenario: Structured slide data enables rich PPTX export
- **WHEN** 前端接收到 engine="pptxgenjs" 的 slide draft
- **THEN** `exportPptx()` SHALL 直接从结构化 JSON 生成 PPTX（不经 markdown 解析）
- **AND** 导出的 PPTX SHALL 在 PowerPoint / LibreOffice / Keynote 中正确打开

### Requirement: Engine-aware export path in frontend

前端导出逻辑 MUST 根据 draft 的 `engine` 字段选择导出路径：

- `engine === "pptxgenjs"` → 从结构化 JSON 直接生成 PPTX
- `engine === "slidev"` → 走现有 `parseSlidesFromMarkdown` 路径

#### Scenario: Slidev drafts export via existing path after engine switch
- **WHEN** 用户切换到 pptxgenjs 引擎后，对一个 `engine = "slidev"` 的旧 draft 执行 PPTX 导出
- **THEN** 系统 SHALL 使用 markdown 解析路径（向后兼容）
- **AND** 导出结果 SHALL 与切换前一致
