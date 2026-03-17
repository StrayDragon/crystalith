## 1. Preset and controls

- [ ] 1.1 定义 preset schema、lineage、version 与 migration hint
- [ ] 1.2 定义 effective controls 回传与 run/output 追踪字段
- [ ] 1.3 复核 preset fallback 与禁用语义

## 2. Draft lifecycle and diffs

- [ ] 2.1 定义 draft / frozen / replaced 等状态机
- [ ] 2.2 定义 diff compare、version review 与 replace/rollback 边界
- [ ] 2.3 定义 section locking 与 incremental regeneration 影响范围

## 3. Style and templates

- [ ] 3.1 定义 composition templates、layout guards 与 section style profiles
- [ ] 3.2 定义 tone guards 与 personal style examples 的表达边界
- [ ] 3.3 复核 style 层不越权改写证据约束

## 4. Regression loop

- [ ] 4.1 定义 regression slices 的切片维度
- [ ] 4.2 定义 failure fingerprints 与 preset/style/draft 的关联
- [ ] 4.3 复核回归结果能回接迁移提示与修复动作

## 5. Verification

- [ ] 5.1 复核 merged proposal 没有重复定义 preset/style/draft/regression 语义
- [ ] 5.2 复核旧 change 的关键信息都已被新 change 收口
- [ ] 5.3 运行 `openspec validate c4070-preset-style-draft-and-regression-loop`
