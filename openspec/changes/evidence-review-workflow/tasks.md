## 1. 审阅对象与状态机

- [x] 1.1 定义结果级审阅状态、evidence review note 与状态转移条件（已确定：draft → pending_review → confirmed / needs_revision，见 design.md）
- [x] 1.2 明确生成完成、质量告警与正式审阅之间的边界（已确定：质量门为自动信号，审阅为手动显式流程，警告可提示但不强制启动审阅）
- [x] 1.3 明确哪些对象需要被审阅记录引用

## 2. 审阅动作与接口

- [x] 2.1 定义提交审阅、标记通过、标记需修订、记录说明等动作语义
- [x] 2.2 明确审阅记录如何关联到结果与证据对象
- [x] 2.3 明确审阅状态在 API 与结果对象中的呈现方式

## 3. 工作区入口与非目标

- [x] 3.1 明确前端如何进入 evidence review 流程与查看状态
- [x] 3.2 明确 review note、citation 状态与结果级状态如何协同展示
- [x] 3.3 明确重型审批能力明确后置

## 4. 验证

- [x] 4.1 运行 `openspec validate evidence-review-workflow`
- [x] 4.2 复核 evidence review 是否独立于生成成功和质量门状态
- [x] 4.3 复核文档中没有滑向重审批系统
