## 1. 诊断面板（Frontend）

- [ ] 1.1 增加读取 `/health/dependencies` 的诊断视图（含 optional services 状态与 recovery_hint）。
- [ ] 1.2 在 Workspace 提供可发现入口（header/命令面板/空态引导中至少一处）。

## 2. 部署与备份恢复文档

- [ ] 2.1 `deployments/README.md` 补齐 core/overlays 的启用条件与验收步骤。
- [ ] 2.2 docs 增加“备份/恢复/迁移”章节：数据路径、最小备份集、恢复步骤、常见陷阱。
- [ ] 2.3 增加常见故障 runbook：症状→诊断→修复（端口、依赖服务、配置错误、网络/SSRF 等）。

## 3. 回归冒烟（可选增强）

- [ ] 3.1 扩展 `scripts/composition_smoke.sh` 场景覆盖（例如全 optional 或关键 optional 组合）。

## 4. Verification

- [ ] 4.1 `just composition-smoke`
- [ ] 4.2 `just docs-build`
