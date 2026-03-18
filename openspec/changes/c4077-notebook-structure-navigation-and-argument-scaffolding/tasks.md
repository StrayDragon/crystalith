## 1. Notebook structure substrate

- [ ] 1.1 定义 block model、block metadata 与块级引用边界
- [ ] 1.2 定义 outline tree、anchors、backlinks 与结构级定位语义
- [ ] 1.3 定义 notebook 结构节点与多 notebook 关系的复用边界

## 2. Suggestions and argument scaffolding

- [ ] 2.1 定义 cross-reference suggestions 与 link inference 的确认边界
- [ ] 2.2 定义 outline 到 argument skeleton 的映射规则
- [ ] 2.3 定义 gap prompts 如何基于结构节点暴露缺口

## 3. Navigation and editing experience

- [ ] 3.1 定义 editor、sidebar、search hit 与 review 的共同落点模型
- [ ] 3.2 定义 focus / collapse / return-point 等结构导航行为
- [ ] 3.3 复核 suggestion / skeleton 不会绕开人工确认直接改写正文

## 4. Verification

- [ ] 4.1 复核 merged proposal 已吸收 4 个旧 change 的关键约束
- [ ] 4.2 复核 block / outline / backlinks / skeleton 语义互相兼容
- [ ] 4.3 运行 `openspec validate c4077-notebook-structure-navigation-and-argument-scaffolding`
