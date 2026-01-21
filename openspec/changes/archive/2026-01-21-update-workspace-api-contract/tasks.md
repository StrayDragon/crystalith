## 1. 实施
- [x] 1.1 更新 Workspace API 合同：工具卡片、输出生成、搜索/Deep Research、建议问题、移除音频/视频
- [x] 1.2 后端：新增工具卡片配置接口与按输出类型的生成接口 (tools.py, outputs.py)
- [x] 1.3 后端：实现 Sources 搜索/Deep Research 的简化对话逻辑并保留 TODO (sources.py + search_graph.py)
- [x] 1.4 后端：移除音频/视频相关端点与引用 (保留文件但功能已弃用，前端不再调用)
- [x] 1.5 前端：拉取工具卡片配置，渲染 Studio 卡片与输出类型选择 (StudioPanel.tsx)
- [x] 1.6 前端：接入建议问题接口并展示可点击建议 (SuggestionPanel.tsx)
- [x] 1.7 前端：完善搜索/Deep Research 交互并展示搜索结果反馈 (SourcesPanel.tsx)
- [x] 1.8 更新或新增测试覆盖关键接口契约 (test_outputs_api.py, test_suggestions_api.py, test_sources_search_api.py)
