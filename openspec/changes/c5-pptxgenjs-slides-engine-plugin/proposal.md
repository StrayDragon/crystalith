# c5: PptxGenJS Slides Engine Plugin

## Why

当前 Crystalith 的 SLIDES 工具依赖 Slidev 作为唯一的演示引擎。Slidev 虽然视觉丰富，但带来显著的运维和部署负担：

- **额外进程**: 需要独立 Node.js 服务（Docker 或本地 `just dev-slidev`）
- **Nginx 代理**: 生产环境需反代 `/slidev/` 路由到 slidev:3030
- **共享文件系统**: 后端通过 `data/output/preview/slides.md` 与 Slidev 通信，跨容器需挂载卷
- **不产出原生文件**: 用户最终还是通过前端 pptxgenjs 导出 .pptx——两套系统做同一件事
- **离线/简单部署受限**: `just up local` 模式下仍需运行 Slidev 才能预览

与此同时，`pptxgenjs` 已作为前端依赖存在（用于 PPTX 导出），但仅以最基础形式使用（标题 + 纯文本要点）。

## What

新建 `slides-pptxgenjs` 插件，实现 `SlidesWorkflowPlugin` 协议，使 PptxGenJS 成为内建的演示引擎选项——与 Slidev 并存，用户可通过配置选择。

### Capabilities

1. **后端 `slides-pptxgenjs` 插件**
   - `engine = "pptxgenjs"`
   - `generate_outline()`: 复用现有大纲生成逻辑（引擎无关）
   - `generate_markdown()`: 改为生成结构化 slide JSON（标题、布局、内容块），而非 Slidev Markdown
   - `preview_descriptor`: `kind="inline"` — 前端内建渲染，无需外部服务
   - `config_schema`: 保持数量/受众/语气/语言/密度选项；主题预设映射到 PptxGenJS 模板

2. **前端 inline 预览组件**
   - 新增 `SlidePreviewInline` 组件，根据结构化 slide 数据渲染 HTML/Canvas 预览
   - 当 `preview.service === "pptxgenjs"` 时替代 iframe 嵌入
   - 支持翻页、全屏、实时更新

3. **增强的 PPTX 导出**
   - 利用结构化 slide JSON 生成更丰富的 .pptx（布局、配色、字体映射）
   - 复用 inline 预览的模板系统

4. **引擎选择机制**
   - `config/app.yaml` 的 `slides.default_plugin` 支持 `slides-pptxgenjs`
   - 前端 Studio Dialog 根据活跃插件的 `preview_descriptor` 自动切换预览模式

### Non-goals

- 不替换 Slidev 引擎——保持并存，用户可选
- 不支持 Slidev 特有能力（演讲者模式、页面动画、代码高亮块）
- 不引入新的数据库迁移——复用现有 `engine` 字段
- 第一期不覆盖复杂布局（双栏、图文混排）——仅标题页 + 内容页（标题 + 要点/段落）

## Impact

| 维度 | 变更 |
|------|------|
| 后端 | 新增 `backend/py/plugins/crystalith-slides-pptxgenjs/` 插件包 |
| 前端 | 新增 inline 预览组件；增强 `exporters.ts` PPTX 导出 |
| 配置 | `slides.default_plugin` 新增可选值 `slides-pptxgenjs` |
| 部署 | PptxGenJS 引擎无需 Slidev 服务——简化 local 和 Docker 部署 |
| 插件协议 | `PreviewDescriptor.kind` 新增 `"inline"` 值 |
| 现有功能 | 不影响 Slidev 引擎——全量向后兼容 |

## Related Changes & Roadmap

- **c4078** (briefing-slide-composition-review-and-sync) — 互补增强提案。c4078 在 slide 语义层面叠加 briefing↔slide 映射、drift 检测和演讲者备注；c5 在引擎/预览/导出层面提供 PptxGenJS 支持。建议 c5 先落地基础引擎，c4078 后续在结构化模型上增强。
- **c2074** (output-renderer-unification) — 基础设施草案。统一 output renderer 注册；c5 的 inline 预览组件未来可适配其统一机制。
- **c4084** (artifact-packaging-interoperability) — 打包互操作。c5 的 PPTX 导出路径需与其 "export to Slides" 语义对齐。

## Verification

- [ ] `slides-pptxgenjs` 插件通过 `SlidesWorkflowPlugin` runtime_checkable 验证
- [ ] `just up local` 模式下，选择 pptxgenjs 引擎后可预览和导出幻灯片，无需 Slidev 服务
- [ ] 前端 inline 预览组件正确渲染结构化 slide 数据
- [ ] PPTX 导出的文件在 PowerPoint / LibreOffice / Keynote 中正确打开
- [ ] Slidev 引擎不受影响——切换回 `slides-slidev` 后行为不变
- [ ] `pnpm test` 和 `just test` 通过
