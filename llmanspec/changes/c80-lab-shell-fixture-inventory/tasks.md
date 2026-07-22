# Tasks: c80-lab-shell-fixture-inventory

## 1. 主表面定位

- [ ] 1.1 更新 `apps/web/AGENTS.md` / Lab 页头注释：`/research-lab` 为深研主表面；fixture 直至 c82
- [ ] 1.2 确认烧瓶入口与路由在 c79 后仍为唯一深研入口

## 2. xlsx-lib fixture 跑通

- [ ] 2.1 默认 scenario 锁定 `xlsx-lib`（可隐藏其它 scenario 或仅 dev 可见）
- [ ] 2.2 走查清单勾选：图 chrome、prune/fork、节点 chat 提案、报告 Plate+cite、revisions、progress、画布设置
- [ ] 2.3 抽出 `LabSessionPort` + fixture 实现；UI 不直接依赖 timer 权威以外的散落状态（可渐进）

## 3. 盘点

- [ ] 3.1 写 `inventory.md`（Keep/Gap/Extra/Ambiguous）对照 ResearchRun
- [ ] 3.2 标注 c81 必改合约 vs 仅文档

## 4. 验证

- [ ] 4.1 Lab 相关 Vitest（scenario 默认 / port）
- [ ] 4.2 `llman sdd validate c80-lab-shell-fixture-inventory --strict --no-interactive`
