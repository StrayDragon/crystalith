## 1. 治理信号模型

- [ ] 1.1 定义 freshness、duplicate candidate、maintenance suggestion 的对象模型
- [ ] 1.2 明确这些信号与接入后来源对象之间的关系
- [ ] 1.3 明确 freshness 与 correctness、review 的边界

## 2. 维护动作与接口

- [ ] 2.1 定义查看治理信号、确认忽略、发起重新导入等动作语义
- [ ] 2.2 明确 duplicate 候选如何被展示与确认
- [ ] 2.3 明确哪些动作是建议，哪些动作会触发实际处理流程

## 3. 产品呈现与长期治理边界

- [ ] 3.1 明确工作区如何展示 stale source、重复候选与维护建议
- [ ] 3.2 明确哪些复杂治理策略明确后置
- [ ] 3.3 明确该 change 不演化成自动整理系统

## 4. 验证

- [ ] 4.1 运行 `openspec validate knowledge-curation-and-freshness`
- [ ] 4.2 复核治理信号是否建立在稳定来源对象之上
- [ ] 4.3 复核文档中没有自动合并、自动删除或自动接管整理的隐含语义
