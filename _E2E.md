# Crystalith v2 — E2E 测试参考

> 创建：2026-07-14 | 最后更新：2026-07-15（c14 清理完成）
> 此文档合并自 `PROGRESS.v2.e2e.md` 和 `OUTPUT_TYPE_E2E_TODO.md`

---

## CDP 操作速查

```bash
.agents/skills/chrome-cdp/scripts/cdp.mjs list                         # 列表页
.agents/skills/chrome-cdp/scripts/cdp.mjs snap <target>                 # 无障碍树
.agents/skills/chrome-cdp/scripts/cdp.mjs shot <target> [file]          # 截图
.agents/skills/chrome-cdp/scripts/cdp.mjs click <target> <selector>     # CSS 点击
.agents/skills/chrome-cdp/scripts/cdp.mjs clickxy <target> <x> <y>     # 坐标点击
.agents/skills/chrome-cdp/scripts/cdp.mjs type <target> <text>          # 输入文字
.agents/skills/chrome-cdp/scripts/cdp.mjs eval <target> <expr>          # 执行 JS
```

## 测试域覆盖

| 域 | 测试项 | 状态 |
|----|--------|------|
| A. 冒烟 | 4 | ✅ 全部通过 |
| B. 对话 | 4 | ✅ 全部通过 |
| C. Sources | 5 | ✅ 全部通过 |
| D. 输出 | 6 | ✅ 全部通过 |
| E. 研究 | 6 | ✅ 全部通过 |
| F. 分析 | 2 | ✅ 全部通过 |
| G. 错误 | 4 | ✅ 全部通过 |
| **总计** | **31** | **✅ 全部通过** |

## 已修复问题（K1–K18）

| # | 问题 | 修复 |
|---|------|------|
| K1 | `@ai-sdk/openai v4` Responses API vs Chat Completions | `provider: openai-compatible` |
| K2 | `strategy_configs` 表不在 migration 中 | `CREATE TABLE IF NOT EXISTS` |
| K3 | QA body 字段 `question` vs `content` | 兼容两者 |
| K4 | Output type 枚举大小写 | 自动 `.toUpperCase()` |
| K5 | Citation 格式 `[Source: N]` vs `[N]` | prompt 改为 `[N]` |
| K6 | `supportsStructuredOutputs` 默认 false | config 设为 true |
| K7 | Research `topic` 字段 `goal` 别名 | 兼容 + fallback |
| K8 | 提取器模式字段路径不匹配 | 嵌套在 policy 键下 |
| K9 | Slidev 超时 | AI provider 性能问题（未修复） |
| K10 | Notes 面板输出渲染 JSON | 添加 `render_descriptor` |
| K11 | Slides Studio 缺 preview 入口 | `buildSlidesConfigSchema()` 返回 preview |
| K12 | GUIDE objective CitedText 渲染 JSON | `coerceText` + `renderTextWithCitations` |
| K13 | Notes 面板无法纵向滚动 | `overflow: hidden → auto` |
| K14 | StudioOutputViewer backdrop 拦截事件 | 内容 div `position: relative` |
| K15 | Slides iframe sandbox CORS + SLIDES JSON | 加 `allow-same-origin` + SlidesMarkdownRenderer |
| K16 | MINDMAP 线性树 → 交互图 | `OutputContent` → MindmapViewer |
| K17 | FAQ/QUIZ/GUIDE/TIMELINE/BRIEFING 回退静态 | 全部分发到交互组件 |
| K18 | QUIZ 选项前缀比较 bug | `extractOptionLetter()` + 删条件4 |

## 输出类型渲染对照

| 类型 | v1 渲染 | v2 渲染 | 状态 |
|------|---------|---------|------|
| MINDMAP | MindmapViewer (ReactFlow) | MindmapViewer | ✅ |
| FAQ | FlashcardViewer (翻转卡) | FlashcardViewer | ✅ |
| QUIZ | QuizRunner (选答+反馈) | QuizRunner | ✅ 修复前缀bug |
| GUIDE | GuideChecklist (勾选) | GuideChecklist | ✅ |
| TIMELINE | TimelineViewer (折叠) | TimelineViewer | ✅ |
| BRIEFING | ReportViewer (目录) | ReportViewer | ✅ |
| SLIDES | SlidesMarkdownRenderer | SlidesMarkdownRenderer | ✅ |
