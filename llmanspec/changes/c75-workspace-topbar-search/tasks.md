## 1. Specs（提案）

- [x] 1.1 充实 `proposal.md` / `design.md` / `tasks.md`
- [x] 1.2 delta：`workspace-ui-core` + `workspace-ui-panels`（MUST/SHALL + scenarios）
- [x] 1.3 `llman sdd validate c75-workspace-topbar-search --strict --no-interactive --stage spec`（提案阶段用 `--stage spec`；apply 勾完实现任务后再跑 full / `just qa`）
- [x] 1.4 删除临时文档 `docs/product/workspace-topbar-search.md`；父 PRD 改为指向本 change

## 2. Top bar + E1 panel

- [ ] 2.1 顶栏中置搜索输入（placeholder 区分搜源/调研）；click/focus 打开 E1 宽幅面板（Layer；Esc/遮罩关闭）
- [ ] 2.2 面板 Tabs：`快速搜索` | `深度研究`（可选第三 Tab 仅占位「笔记内搜」禁用）
- [ ] 2.3 抽出共享网搜+加来源 hook；禁止在 Sources 与 TopBar 各留一份 SearXNG 调用

验证：相关 web Vitest；手动打开面板

## 3. Fast search tab（行为对齐旧 Sources）

- [ ] 3.1 query → 现有 sources 网搜 API → 结果列表（标题/摘要/URL/引擎）
- [ ] 3.2 多选 → 添加到当前 notebook（现有 ingest）
- [ ] 3.3 空态 / loading / SearXNG 不可用错误文案

验证：web Vitest；可选手动

## 4. Sources 栏瘦身 + 深研壳

- [ ] 4.1 移除来源栏主网搜条与 Deep/Fast 模式切换；可选「筛选已有来源」filter
- [ ] 4.2 深度研究 Tab：壳 +「正在重建」类提示；开始禁用或 toast；MUST NOT 调 research agent
- [ ] 4.3 隐藏/移除 Sources 内旧 Deep Research 主入口与依赖该入口的队列展示（或链到深研壳）

验证：SourcesPanel 相关 Vitest 更新

## 5. Testids + 门禁

- [ ] 5.1 更新 `e2e/fixtures/testids` 与 `@p0`（原 S06 等搜源入口 → 顶栏）
- [ ] 5.2 `bun typecheck` + `just test-web` + `just e2e`（或全量 `just qa`）

验证：`just qa`
