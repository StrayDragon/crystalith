# c5: Tasks — PptxGenJS Slides Engine Plugin

## Roadmap & Dependencies

### 相关 Changes

| Change | 关系 | 协调要点 |
|--------|------|---------|
| **c4078** briefing-slide-composition-review-and-sync | **互补增强** — c4078 聚焦 briefing↔slide 语义映射、drift 检测、演讲者备注 | c5 的结构化 slide JSON model 需预留 c4078 所需的字段扩展点（如 `notes`、`evidence_refs`）；若 c4078 先落地，c5 需适配其 slide 映射协议 |
| **c2074** output-renderer-unification-and-template-versioning | **基础设施互补**（草案阶段） | c5 的 `SlidePreviewInline` 组件未来可能需适配 c2074 的统一 renderer 注册机制；当前无阻塞 |
| **c4084** artifact-packaging-versioning-interoperability | **打包互补** | c5 的 PPTX 导出路径需与 c4084 的 "export to Slides" 语义对齐 |

### 推荐顺序

1. **c5**（本 change）— 引擎基础：插件 + 预览 + 导出
2. **c4078** — 语义增强：在 c5 的结构化模型上叠加 briefing↔slide 映射和 drift
3. **c2074 / c4084** — 平台统一：在多引擎稳定后统一 renderer 和 packaging

---

## Phase 1: 后端插件脚手架

- [ ] **T1.1** 创建 `backend/py/plugins/crystalith-slides-pptxgenjs/` 包结构
  - `pyproject.toml` with entry point `slides-pptxgenjs`
  - `src/crystalith_slides_pptxgenjs/__init__.py`
  - `src/crystalith_slides_pptxgenjs/plugin.py`
  - `src/crystalith_slides_pptxgenjs/config.py`
  - `src/crystalith_slides_pptxgenjs/generator.py`
  - Verify: `cd backend/py && uv sync`

- [ ] **T1.2** 在 `render_types.py` 中扩展 `PreviewDescriptor.kind` 支持 `"inline"`
  - Verify: `cd backend/py && just test`

- [ ] **T1.3** 实现 `PptxGenjsSlidesWorkflowPlugin` 类
  - `engine = "pptxgenjs"`
  - `preview_descriptor = PreviewDescriptor(kind="inline", service="pptxgenjs")`
  - `config_schema` 复用量/受众/语气/密度选项
  - Verify: `python -c "from crystalith.shared.plugins.interfaces import SlidesWorkflowPlugin; from crystalith_slides_pptxgenjs.plugin import plugin; assert isinstance(plugin, SlidesWorkflowPlugin)"`

- [ ] **T1.4** 实现 `generate_outline()` — 复用核心大纲生成逻辑
  - Verify: `cd backend/py && just test`

- [ ] **T1.5** 实现 `generate_markdown()` — 输出结构化 slide JSON
  - 定义 `SlideSpec` Pydantic model (title, slides: list[SlideItem])
  - LLM prompt 指导输出 JSON 而非 Slidev Markdown
  - Verify: `cd backend/py && just test`

- [ ] **T1.6** 注册插件到 `official_catalog.py` 和 `pyproject.toml` optional-dependencies
  - Verify: `cd backend/py && uv sync && just test`

## Phase 2: 前端 Inline 预览

- [ ] **T2.1** 新增 `SlidePreviewInline.tsx` 组件
  - 接收结构化 slide JSON
  - 渲染 HTML/CSS slide 卡片（title/content 两种 layout）
  - 翻页导航、当前页指示器
  - Verify: `cd frontend/web && pnpm test`

- [ ] **T2.2** 在 `SlidesStudioDialog.tsx` 中根据 `preview_descriptor.kind` 分支
  - `kind === "external_url"` → 现有 iframe 行为
  - `kind === "inline"` → 渲染 `SlidePreviewInline`
  - Verify: `cd frontend/web && pnpm test`

- [ ] **T2.3** `SlidePreviewInline` 支持全屏模式
  - Verify: 手动测试 — 全屏后幻灯片填满视口，ESC 退出

## Phase 3: 增强 PPTX 导出

- [ ] **T3.1** 在 `exporters.ts` 中新增 `buildSlidesExportItemsFromJson()` — 从结构化 JSON 解析
  - Verify: `cd frontend/web && pnpm test`

- [ ] **T3.2** `buildSlidesExportItems()` 根据 engine 分支
  - `engine === "pptxgenjs"` → `buildSlidesExportItemsFromJson()`
  - `engine === "slidev"` → 现有 markdown 解析路径
  - Verify: `cd frontend/web && pnpm test`

- [ ] **T3.3** 增强 `exportPptx()` — 利用 PptxGenJS 丰富 API
  - 标题页：居中大标题 + 副标题
  - 内容页：标题 + bullet list（使用 PptxGenJS bullet API）
  - 预设配色方案
  - Verify: 导出 .pptx 后在 LibreOffice 中打开验证

## Phase 4: 配置与集成

- [ ] **T4.1** 更新 `config/app.schema.gen.json` 支持 `slides.default_plugin: "slides-pptxgenjs"`
  - Verify: `cd backend/py && just config-schema`

- [ ] **T4.2** 前端 output-slides 插件读取 engine 信息并适配渲染
  - Verify: `cd frontend/web && pnpm test`

- [ ] **T4.3** 更新文档
  - `backend/py/plugins/README.md` 新增 pptxgenjs 插件说明
  - `docs/doc/deployment.md` 说明无 Slidev 部署选项
  - Verify: 文档审阅

## Phase 5: 验证

- [ ] **T5.1** 端到端：`just up local` + `slides.default_plugin: slides-pptxgenjs` → 创建 draft → 预览 → 导出
- [ ] **T5.2** 并存验证：安装两个插件 + 不配置默认 → 诊断提示正确
- [ ] **T5.3** 回退验证：切回 `slides-slidev` → Slidev 预览和功能不受影响
- [ ] **T5.4** `cd backend/py && just test`
- [ ] **T5.5** `cd frontend/web && pnpm test`
- [ ] **T5.6** `cd frontend/web && pnpm typecheck`
