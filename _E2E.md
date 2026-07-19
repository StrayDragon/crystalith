# Crystalith v2 — E2E 测试参考

> 创建：2026-07-14 | 最后更新：2026-07-19（对齐 Playwright `@p0` 现实）
> 独立文档；门禁 SSOT 见 `e2e/AGENTS.md` + `just e2e` / `just qa`。

---

## 命令

```bash
just e2e-install   # 可选：安装 Playwright Chromium（本地默认可系统 Chrome）
just e2e           # 门禁：playwright --grep @p0
just e2e-all       # 当前与 @p0 同集；预留非门禁规格
just qa            # 含 e2e @p0（见根 AGENTS.md：primary PR gate）
```

选择器必须用 `apps/web/src/shared/testids.ts` 的 `data-testid`，不要锁中文文案。

隔离端口：web `13000`，API `18032`，DB `e2e/.tmp/crystalith.e2e.db`。

## 测试域覆盖（`e2e/tests/p0-smoke.spec.ts`）

当前门禁是 **单文件 workspace smoke**，共 **26** 项（`@p0`）：

| 前缀     | 域              | 项数   | 说明                           |
| -------- | --------------- | ------ | ------------------------------ |
| A        | 冒烟 / API      | 4      | shell、health、camelCase、引导 |
| N        | Notebooks       | 3      | 切换器 / 创建控件 / API 创建   |
| S        | Sources         | 8      | 面板、连接器、上传、搜索、详情 |
| C        | Chat            | 3      | 输入、会话切换、草稿           |
| O        | Outputs/Studio  | 2      | generate popover、add note     |
| L        | Layout / chrome | 6      | 命令面板、锁定、用户菜单       |
| **合计** |                 | **26** |                                |

**不在当前 `@p0` 内**（旧文档曾宣称，现已移除或未落地）：研究流 E2E、错误域专项、旧 A–G 29 项分类。

> 原「F. 分析 / 知识图谱」E2E 域已于 2026-07-17 随功能移除下线。

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

## 已修复问题（K1–K18）

| #   | 问题                                                  | 修复                                            |
| --- | ----------------------------------------------------- | ----------------------------------------------- |
| K1  | `@ai-sdk/openai v4` Responses API vs Chat Completions | `provider: openai-compatible`                   |
| K2  | `strategy_configs` 表不在 migration 中                | `CREATE TABLE IF NOT EXISTS`                    |
| K3  | QA body 字段 `question` vs `content`                  | 兼容两者                                        |
| K4  | Output type 枚举大小写                                | 自动 `.toUpperCase()`                           |
| K5  | Citation 格式 `[Source: N]` vs `[N]`                  | prompt 改为 `[N]`                               |
| K6  | `supportsStructuredOutputs` 默认 false                | config 设为 true                                |
| K7  | Research `topic` 字段 `goal` 别名                     | 兼容 + fallback                                 |
| K8  | 提取器模式字段路径不匹配                              | 嵌套在 policy 键下                              |
| K9  | Slidev 超时                                           | AI provider 性能问题（未修复）                  |
| K10 | Notes 面板输出渲染 JSON                               | 添加 `render_descriptor`                        |
| K11 | Slides Studio 缺 preview 入口                         | `buildSlidesConfigSchema()` 返回 preview        |
| K12 | GUIDE objective CitedText 渲染 JSON                   | `coerceText` + `renderTextWithCitations`        |
| K13 | Notes 面板无法纵向滚动                                | `overflow: hidden → auto`                       |
| K14 | StudioOutputViewer backdrop 拦截事件                  | 内容 div `position: relative`                   |
| K15 | Slides iframe sandbox CORS + SLIDES JSON              | 加 `allow-same-origin` + SlidesMarkdownRenderer |
| K16 | MINDMAP 线性树 → 交互图                               | `OutputContent` → MindmapViewer                 |
| K17 | FAQ/QUIZ/GUIDE/TIMELINE/BRIEFING 回退静态             | 全部分发到交互组件                              |
| K18 | QUIZ 选项前缀比较 bug                                 | `extractOptionLetter()` + 删条件4               |

## 输出类型渲染对照

| 类型     | v1 渲染                   | v2 渲染                | 状态           |
| -------- | ------------------------- | ---------------------- | -------------- |
| MINDMAP  | MindmapViewer (ReactFlow) | MindmapViewer          | ✅             |
| FAQ      | FlashcardViewer (翻转卡)  | FlashcardViewer        | ✅             |
| QUIZ     | QuizRunner (选答+反馈)    | QuizRunner             | ✅ 修复前缀bug |
| GUIDE    | GuideChecklist (勾选)     | GuideChecklist         | ✅             |
| TIMELINE | TimelineViewer (折叠)     | TimelineViewer         | ✅             |
| BRIEFING | ReportViewer (目录)       | ReportViewer           | ✅             |
| SLIDES   | SlidesMarkdownRenderer    | SlidesMarkdownRenderer | ✅             |
