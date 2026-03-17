## 1. Action model

- [ ] 1.1 定义统一 action / command schema 与 scope 语义
- [ ] 1.2 定义 enabled_when、risk_level 与 side_effects 表达
- [ ] 1.3 定义 context actions、recent actions 与 shortcuts 元数据

## 2. Routing and composition

- [ ] 2.1 定义 intent routing 与 handler 选择边界
- [ ] 2.2 定义 action composition、preview、cancel 与 failure hints
- [ ] 2.3 定义 UI 如何传递 context 并消费 routing 结果

## 3. Canonical action surface

- [ ] 3.1 定义 panels/widgets/plugins 如何统一注册 action
- [ ] 3.2 定义 command palette / shortcuts / recommendations 的共用索引
- [ ] 3.3 复核 action surface 与 command routing 语义互相支撑

## 4. Verification

- [ ] 4.1 复核 merged proposal 已吸收 2 个旧 change 的关键约束
- [ ] 4.2 复核没有留下平行的动作入口真相
- [ ] 4.3 运行 `openspec validate c4089-command-action-surface-routing-and-composition`
