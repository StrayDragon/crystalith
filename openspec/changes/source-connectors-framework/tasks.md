## 1. 宿主模型与对象边界

- [ ] 1.1 定义 connector、binding、snapshot、import_scope、sync_check 的宿主对象模型
- [ ] 1.2 明确哪些能力属于宿主，哪些属于 connector 实现者
- [ ] 1.3 明确 notebook-scoped binding 的持久化边界

## 2. 接口与执行流程

- [ ] 2.1 定义连接器发现、binding 创建、snapshot、导入与 sync_check 的接口语义
- [ ] 2.2 明确 snapshot 预览与选择性导入的顺序关系
- [ ] 2.3 明确 sync_check 的输入、输出与确认应用边界

## 3. 宿主交互与插件契约

- [ ] 3.1 明确宿主通用 UI/流程壳子的责任范围
- [ ] 3.2 明确 connector 提供配置 schema、诊断与内容读取的契约
- [ ] 3.3 明确官方样板插件如何验证框架，而不是反向定义框架

## 4. 验证

- [ ] 4.1 运行 `openspec validate source-connectors-framework`
- [ ] 4.2 复核框架定义是否足以支撑大 vault、子集选择与显式 `sync_check`
- [ ] 4.3 复核文档中没有把通用工作流 UI 下放给单个 connector
