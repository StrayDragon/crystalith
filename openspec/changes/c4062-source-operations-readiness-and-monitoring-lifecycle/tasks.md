## 1. Source health foundation

- [ ] 1.1 定义 `source` / `source_pack` / `watcher` 三层对象的 readiness 与 freshness 字段边界
- [ ] 1.2 明确每层对象的异常提示、恢复动作与人工覆盖规则
- [ ] 1.3 复核来源健康信号不会被误用为内容真伪裁决

## 2. Refresh policy and auto recheck

- [ ] 2.1 定义 refresh policy profiles（head-only / summary-diff / full-refetch）
- [ ] 2.2 明确 auto recheck 的触发条件、节流策略与人工覆盖优先级
- [ ] 2.3 复核 refresh policy 能同时挂到单条 source 与 source pack

## 3. Source packs and refresh briefs

- [ ] 3.1 定义 source pack 生命周期、watchlist 输入边界与版本化语义
- [ ] 3.2 定义 refresh diff / refresh brief 的最小输出字段与重读建议规则
- [ ] 3.3 定义 source bundle comparison 与 readiness ranking 的解释语义

## 4. Watchers and reliability regression

- [ ] 4.1 定义 watcher 的 trigger、state、quiet window、failure retry 与 run history
- [ ] 4.2 定义 delta brief 如何回挂 source pack、阅读队列与月度摘要
- [ ] 4.3 定义 reliability regression / watch flag 如何驱动补抓、重排与谨慎提示

## 5. UX and contracts

- [ ] 5.1 明确 Sources / Source Pack / Watcher 三类入口的最小 UI 契约
- [ ] 5.2 明确 workspace API 如何返回 readiness、policy、diff、timeline 与 watch flags
- [ ] 5.3 明确 background jobs 如何支持周期复查、事件触发、暂停恢复与失败重试

## 6. Verification

- [ ] 6.1 复核 merged proposal 没有重复定义 refresh / watcher / reliability 语义
- [ ] 6.2 复核旧 change 的关键信息都已被新 change 收口
- [ ] 6.3 运行 `openspec validate c4062-source-operations-readiness-and-monitoring-lifecycle`
