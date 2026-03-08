## 1. collection 对象与边界

- [ ] 1.1 定义 collection 与 notebook 的绑定关系、身份边界与作用域
- [ ] 1.2 明确 collection 级上下文与 notebook 原生上下文如何共存
- [ ] 1.3 明确 collection 不吞掉 notebook 语义的设计边界

## 2. 检索、导航与接口

- [ ] 2.1 定义 collection-scoped 检索与导航的最小语义
- [ ] 2.2 定义 collection 列表、详情、绑定 notebook 与上下文切换接口
- [ ] 2.3 明确 collection 内结果如何保留 notebook 来源归属

## 3. 产品体验与后置能力

- [ ] 3.1 明确 collection 在工作区中的入口与主要视图
- [ ] 3.2 明确 collection 如何成为更大的工作现场而不是更复杂的容器
- [ ] 3.3 明确 collection 级模板、审阅、发布联动为后置能力

## 4. 验证

- [ ] 4.1 运行 `openspec validate multi-notebook-collections`
- [ ] 4.2 复核 collection 是否保留 notebook 的身份与来源归属边界
- [ ] 4.3 复核文档中没有把 collection 写成万能容器
