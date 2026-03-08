## 背景

当用户积累了多个 notebook 后，下一层需求不是把它们全部糊成一个万能容器，而是需要一个更大的工作现场，让多个 notebook 能在特定上下文下被组织、检索和产出。collection 的价值在于放大空间层，而不是吞掉 notebook 的边界。

## 已确定决策

### D1：collection 是 notebook 之上的聚合层
- collection 通过绑定多个 notebook 构成更大的工作现场。
- notebook 自身身份、边界和已有能力必须保留。

### D2：collection 需要自己的检索与导航语义
- collection 不是纯列表容器。
- 它需要支持 collection-scoped 导航、检索和上下文切换。

### D3：collection 不重写 notebook 语义
- collection 不替代 notebook。
- notebook 仍然是基础工作单元和来源归属边界。

### D4：v1 不做万能空间平台
- collection 先解决多 notebook 组织与工作上下文问题。
- collection 级模板、审阅和发布联动后置。

## 非目标

- 不把 collection 做成万能容器。
- 不吞掉 notebook 的身份、导航和边界。
- 不在本 change 中扩展 collection 级模板、审阅和发布联动。
