## 1. Config source and drift contract

- [ ] 1.1 固化 config/app.yaml、overlay、secrets 与定位变量的装配顺序
- [ ] 1.2 定义 effective config 的 redaction、输出范围与 drift diff 语义
- [ ] 1.3 定义 schema validate 与 drift gate 的最低要求

## 2. Optional services readiness

- [ ] 2.1 定义 optional service 的统一状态字段、probe 频率与缓存规则
- [ ] 2.2 定义 reason_code、hint、next_action 与 degraded_mode 的输出约束
- [ ] 2.3 复核可选服务不可用时核心路径仍保持可恢复

## 3. Capability matrix and degraded mode

- [ ] 3.1 定义 profile capability matrix 的输入、输出与 strict mode 边界
- [ ] 3.2 明确哪些能力允许 degraded，哪些必须 hard fail
- [ ] 3.3 定义 capability matrix 如何进入 API、diagnostics 与首页卡片

## 4. Parser and fallback semantics

- [ ] 4.1 定义 parser capability matrix 与 format fallback 语义
- [ ] 4.2 定义结构保真、文本保真、元数据保真三类说明字段
- [ ] 4.3 复核来源状态与导入提示能消费保真度信息

## 5. Governance and safe defaults

- [ ] 5.1 定义 config rationale journal 的最小字段
- [ ] 5.2 定义 safe default audit 的输出与复核入口
- [ ] 5.3 复核 drift explainer 能引用 rationale 与高风险默认值

## 6. Verification

- [ ] 6.1 复核 merged proposal 没有重复定义 config/profile/degraded 语义
- [ ] 6.2 复核旧 change 的关键信息都已被新 change 收口
- [ ] 6.3 运行 `openspec validate c4064-config-profiles-capability-matrix-and-degraded-mode`
