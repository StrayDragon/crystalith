## 1. Runtime signals and budgets

- [ ] 1.1 定义 shell/panel/stream 的关键 performance marks
- [ ] 1.2 定义 LCP / INP / CLS 与关键交互预算
- [ ] 1.3 定义按场景与构建维度输出 perf report 的边界

## 2. Frontend load-shaping rules

- [ ] 2.1 定义 selector、memo 与 render attribution 规则
- [ ] 2.2 定义高增长列表的 virtualization 与分页组合规则
- [ ] 2.3 定义 workspace panel lazy mount、code splitting 与壳层集中订阅规则

## 3. Regression harness and rollout

- [ ] 3.1 定义 deterministic large-workspace fixtures 与 benchmark actions
- [ ] 3.2 定义 baseline diff、noise band 与 warn → gate 策略
- [ ] 3.3 定义 dev-only profiler overlay 与复制摘要格式

## 4. Verification

- [ ] 4.1 复核 merged proposal 已吸收 4 个旧 change 的关键约束
- [ ] 4.2 复核性能预算与 lazy/virtualization 规则互相支撑而不冲突
- [ ] 4.3 运行 `openspec validate c4075-workspace-frontend-performance-and-load-shaping`
