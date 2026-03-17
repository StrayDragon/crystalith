## 1. Unified execution policy

- [ ] 1.1 定义 tool / object / action 三级授权与 policy overlay 语义
- [ ] 1.2 定义 risk tier、提权请求与临时 lease 的 contract
- [ ] 1.3 定义 sandbox profile 的 network / filesystem / time / concurrency / secrets 边界

## 2. Background runtime integration

- [ ] 2.1 定义 compute-class jobs 如何声明 resource profile 与 sandbox lease
- [ ] 2.2 定义 compute execution 的排队、取消、恢复与审计事件边界
- [ ] 2.3 复核 background job substrate 与 execution policy evaluator 的职责拆分

## 3. Compute cell and outputs

- [ ] 3.1 定义 compute cell 作为正式 block 类型的执行与状态语义
- [ ] 3.2 定义 typed results、artifact refs 与 Notebook 挂接方式
- [ ] 3.3 复核 compute cell 与 agent tool 共用统一 execution plane 且没有平行配置真相

## 4. Verification

- [ ] 4.1 复核 merged proposal 已吸收 `c1005` 与 `c2028` 的核心约束
- [ ] 4.2 复核 unified execution policy、compute runtime 与 background jobs 语义互相支撑
- [ ] 4.3 运行 `openspec validate c4091-agent-sandbox-permissions-and-compute-runtime`
