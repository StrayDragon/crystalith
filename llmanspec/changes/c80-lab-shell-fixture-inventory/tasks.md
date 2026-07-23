# Tasks: c80-lab-shell-fixture-inventory

## 1. 主表面定位

- [ ] 1.1 更新 `apps/web/AGENTS.md` / Lab 页头注释：作业台 + Compose + 任务队列（头像旁与 Lab 顶栏）；fixture 直至 c82
- [ ] 1.2 确认闭环入口：烧瓶 / 抽屉「新建」→ Compose；**不**规划对话 `@`/`/`（延后另 change）

## 2. xlsx-lib fixture + demo 任务队列跑通

- [ ] 2.1 默认 scenario 锁定 `xlsx-lib`（可隐藏其它 scenario 或仅高级控制台）
- [ ] 2.2 走查：Compose → 回放 → 图 chrome / prune/fork / 节点 chat / 报告 Plate+cite / revisions / progress
- [ ] 2.3 任务抽屉：工作区头像旁 + Lab 顶栏最右均可打开；切换 run id；badge=进行中计数
- [ ] 2.4 抽出 `LabSessionPort` + fixture（含 list/switch demo tasks）；UI 不直接依赖 timer 权威以外的散落状态（可渐进）

## 3. 盘点

- [ ] 3.1 写 `inventory.md`（Keep/Gap/Extra/Ambiguous），**必含** Compose / 任务列表 / badge / list 瘦身与 status 过滤
- [ ] 3.2 标注 c81 必改 vs 文档 vs **deferred**（对话 `@`/`/`）

## 4. 验证

- [ ] 4.1 Lab 相关 Vitest（scenario 默认 / port / demo tasks store）
- [ ] 4.2 `llman sdd validate c80-lab-shell-fixture-inventory --strict --no-interactive`
