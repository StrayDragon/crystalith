## 1. Provenance and replay substrate

- [ ] 1.1 定义 provenance package 与 run/artifact input snapshot 结构
- [ ] 1.2 定义 execution trace、checkpoint replay 与 explainability summary
- [ ] 1.3 定义 replay diff 输出与权限分层边界

## 2. Repro and fixture pipeline

- [ ] 2.1 定义 repro pack、sanitized fixture 与 replay 入口
- [ ] 2.2 定义 real-workspace eval capture、sanitization 与 lineage 规则
- [ ] 2.3 定义 fixture refresh cadence 与 baseline exceptions 语义

## 3. Stability and triage

- [ ] 3.1 定义 reproducibility seals 与 result stability checks
- [ ] 3.2 定义 regression failure triage bundles 与 shareable reports
- [ ] 3.3 复核 provenance / replay / repro / triage 语义互相支撑

## 4. Verification

- [ ] 4.1 复核 merged proposal 已吸收 6 个旧 change 的关键约束
- [ ] 4.2 复核没有留下平行的 replay/repro 真相
- [ ] 4.3 运行 `openspec validate c4090-provenance-replay-repro-and-regression-triage-foundation`
