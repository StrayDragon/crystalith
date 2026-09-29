# Tasks

- [x] t1 r101 条件轮询：导出 `researchQueuePollInterval` 纯函数（active>0 → 5s，否则 0）并接入 useResearchTasks 的 SWR refreshInterval。验证：纯函数三态锁测（researchQueuePoll.test 3 用例）+ SWR 数据依赖 interval 接入；web 套件无回归。
- [x] t2 [blocked-by: t1] r416 面板错误快照：SourcesPanelView 头部失败摘要条（uploadQueue error 项 + sources failed 聚合，含首条错误消息）。验证：SourcesPanel.test 扩展 2 用例（有失败显示计数与首条消息/无失败不渲染）全绿（文件 7/7）。
- [x] t3 [blocked-by: t2] specs：r101/r416 场景化锚定新测试；r405/r411/r413/r417 移除。验证：validate specs 通过（步骤关键词勘误 2 处 + r417 顶格 tag 特殊处理）；review unbound 47 → 41 精确命中。
- [x] t4 [blocked-by: t3] 回归收口：`just test-web` + `just qa` 全绿；地图转纯记录态（finalize 后 main 提交）。
