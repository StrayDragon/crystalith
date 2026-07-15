# Output Type E2E Verification TODO

> v1 行为通过 plugins system (`allPlugins.tsx`) 提供交互式渲染
> v2 当前回退到 `renderDescriptor` → `GenericOutputRenderer`（静态）

## 总策略

在 `OutputContent.tsx` 中为每个应交互式渲染的类型添加特判分支，使用 `allPlugins.tsx` 中的对应 `plugin.render`，类型于已完成的 MINDMAP 修复。

## 渲染路由优先级（修改后）

```
1. bundleRenderer (frontend_bundle/plugin 系统) → null, 未来用
2. 类型特判分支 (全部已对齐 v1):
     MINDMAP  → MindmapViewer (ReactFlow 交互图)       ✅
     FAQ      → FlashcardViewer (翻转卡)                ✅
     QUIZ     → QuizRunner (选答→提交→反馈)             ✅
     GUIDE    → GuideChecklist (勾选+折叠模块)          ✅
     TIMELINE → TimelineViewer (展开/折叠事件轴)        ✅
     BRIEFING → ReportViewer (目录侧栏+滚动内容)        ✅
3. renderDescriptor → GenericOutputRenderer (静态回退)
4. SLIDES 特判 → SlidesMarkdownRenderer                ✅
5. fallback → JSON <pre>
```

## 检查清单

### v1 交互式组件映射

| 输出类型   | v1 plugin.render         | 用到的组件       | v2 当前渲染           | 状态 |
| ---------- | ------------------------ | ---------------- | --------------------- | ---- |
| MINDMAP    | `MindmapViewer`          | ReactFlow 交互图 | ✅ OutputContent 特判 | ✅   |
| FAQ        | `FlashcardViewer`        | 点击翻转卡       | ✅ OutputContent 特判 | ✅   |
| QUIZ       | `QuizRunner`             | 选答→提交→评分   | ✅ OutputContent 特判 | ✅   |
| GUIDE      | `GuideChecklist`         | 勾选+折叠模块    | ✅ OutputContent 特判 | ✅   |
| TIMELINE   | `TimelineViewer`         | 展开/折叠事件    | ✅ OutputContent 特判 | ✅   |
| BRIEFING   | `ReportViewer`           | 目录侧栏+内容    | ✅ OutputContent 特判 | ✅   |
| SLIDES     | `SlidesMarkdownRenderer` | 幻灯片预览       | ✅ 已有               | ✅   |
| PARAGRAPH  | —                        | JSON fallback    | ✅                    | —    |
| BULLETS    | —                        | JSON fallback    | ✅                    | —    |
| STRUCTURED | —                        | JSON fallback    | ✅                    | —    |

### 步骤

    1. [x] QUIZ → QuizRunner：添加 `typeId === 'QUIZ'` 分支，使用 `QuizRunner` 组件

2. [x] FAQ → FlashcardViewer：添加 `typeId === 'FAQ'` 分支，使用 `FlashcardViewer` 组件3. [x] GUIDE → GuideChecklist：添加 `typeId === 'GUIDE'` 分支4. [x] TIMELINE → TimelineViewer：添加 `typeId === 'TIMELINE'` 分支5. [x] BRIEFING → ReportViewer：添加 `typeId === 'BRIEFING'` 分支 6. [ ] 生成 AI 输出并验证每种类型的实际渲染 7. [ ] 更新 _WEB_DELTA.md 记录差异和修复 8. [ ] 更新 PROGRESS.v2.e2e.md 记录新发现的差异

## CDP 验证流程（每种类型）

```bash
# 1. 在 Notes 面板中找到对应类型的输出条目，点击打开
click <target> '[data-testid="studio-output-item"]'
# 2. 检查 dialog 中的渲染内容
eval <target> "document.querySelector('[role=\"dialog\"]')?.innerHTML"
# 3. 对比预期行为并截图
shot <target> "e2e-{type}-render.png"
# 4. 关闭 dialog
click <target> 'button[aria-label="关闭"]'
```
