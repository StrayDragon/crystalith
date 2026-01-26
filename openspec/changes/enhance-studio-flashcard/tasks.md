## 1. 数据模型与后端

- [ ] 1.1 设计 FlashcardProgress 数据模型（card_id, ease_factor, interval, due_date, repetitions）
- [ ] 1.2 实现 SM-2 间隔重复算法
- [ ] 1.3 添加 API 端点：`POST /outputs/{id}/flashcard/review` 记录复习结果
- [ ] 1.4 添加 API 端点：`GET /outputs/{id}/flashcard/due` 获取待复习卡片
- [ ] 1.5 扩展 FAQ 生成器，支持生成双面卡片格式

## 2. 前端交互组件

- [ ] 2.1 创建 FlashcardViewer 组件，支持翻转动画
- [ ] 2.2 实现卡片堆叠视图，支持左右滑动
- [ ] 2.3 添加掌握度评分按钮（Again/Hard/Good/Easy）
- [ ] 2.4 实现学习模式：顺序展示所有卡片
- [ ] 2.5 实现测试模式：仅展示待复习卡片

## 3. 进度追踪与统计

- [ ] 3.1 创建学习进度面板，显示统计数据
- [ ] 3.2 实现进度条可视化（新/学习中/已掌握）
- [ ] 3.3 添加每日复习目标设置

## 4. 导出功能

- [ ] 4.1 实现 Anki .apkg 格式导出
- [ ] 4.2 支持导出为 CSV 格式
- [ ] 4.3 支持导出为 Markdown 格式

## 5. 测试与文档

- [ ] 5.1 编写 SM-2 算法单元测试
- [ ] 5.2 编写 FlashcardViewer 组件测试
- [ ] 5.3 更新用户文档
