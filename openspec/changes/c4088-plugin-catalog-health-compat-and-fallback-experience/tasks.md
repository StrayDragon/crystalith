## 1. Catalog and runtime truth

- [ ] 1.1 定义 official plugin catalog、delivery tiers 与状态词汇
- [ ] 1.2 定义 loaded/skipped/not_installed 与 install hint 的计算语义
- [ ] 1.3 定义 API diagnostics 与 UI capability matrix 的共用字段

## 2. Health and compatibility

- [ ] 2.1 定义 plugin metadata、readiness_check 与 host smoke tests
- [ ] 2.2 定义 backend/frontend compat matrix 与 bundle smoke 规则
- [ ] 2.3 定义 CI / local smoke 输出与诊断消费边界

## 3. Fallback and docs

- [ ] 3.1 定义 frontend bundle loader state machine、error classes 与 fallback UX
- [ ] 3.2 定义 docs capability matrix 如何复用 runtime/catalog 真相
- [ ] 3.3 复核 catalog / runtime / docs / fallback 语义互相支撑

## 4. Verification

- [ ] 4.1 复核 merged proposal 已吸收 4 个旧 change 的关键约束
- [ ] 4.2 复核没有留下多套插件能力现状真相
- [ ] 4.3 运行 `openspec validate c4088-plugin-catalog-health-compat-and-fallback-experience`
