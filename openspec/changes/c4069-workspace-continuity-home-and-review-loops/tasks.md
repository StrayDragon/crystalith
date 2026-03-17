## 1. Continuity model

- [ ] 1.1 定义 layout preset、view memory、focus mode 与 temporary state 的边界
- [ ] 1.2 定义 handoff point、return point 与最小恢复上下文字段
- [ ] 1.3 定义 cross-panel selection 与 deep link 的统一定位规则

## 2. Home prioritization

- [ ] 2.1 定义 adaptive home cards 的优先级输入与 collapse 规则
- [ ] 2.2 定义 pinned cards、continue-work 与 next-action 的协同关系
- [ ] 2.3 复核首页不会因为动态排序而隐藏关键阻塞项

## 3. Review and resurfacing

- [ ] 3.1 定义 daily review、resurfacing 与 deferred item 语义
- [ ] 3.2 定义 personal work queues / review buckets 与对象流转动作
- [ ] 3.3 定义 activity heatmap / routine loop 的轻量信号边界

## 4. UX contracts

- [ ] 4.1 定义从 home、URL、命令动作、搜索结果回到同一落点的 contract
- [ ] 4.2 定义 focus mode 与 distraction pruning 的恢复语义
- [ ] 4.3 复核 temporary focus 不会污染长期 layout 偏好

## 5. Verification

- [ ] 5.1 复核 merged proposal 没有重复定义 continuity/home/review 语义
- [ ] 5.2 复核旧 change 的关键信息都已被新 change 收口
- [ ] 5.3 运行 `openspec validate c4069-workspace-continuity-home-and-review-loops`
