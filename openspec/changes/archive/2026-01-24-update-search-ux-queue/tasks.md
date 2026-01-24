## 1. 实现搜索队列状态管理

- [x] 1.1 在 `useSources` hook 中添加搜索队列状态类型定义（`SearchQueueItem`）
- [x] 1.2 实现搜索队列状态管理（`searchQueue: SearchQueueItem[]`）
- [x] 1.3 修改 `handleSearch` 函数，立即创建 loading 状态的队列项

## 2. 更新搜索结果队列组件

- [x] 2.1 修改 `SearchResultsQueue` 支持显示多个搜索队列项
- [x] 2.2 为每个队列项添加 loading/loaded/error 状态显示
- [x] 2.3 支持单独清除某个搜索队列项

## 3. 修改添加来源后的行为

- [x] 3.1 修改 `handleAddComplete` 不自动清空搜索结果
- [x] 3.2 添加来源后仅从队列中移除已添加的结果项
- [x] 3.3 保持搜索队列可见，允许继续操作

## 4. 移除搜索按钮禁用逻辑

- [x] 4.1 移除搜索进行中时的按钮禁用状态
- [x] 4.2 允许用户在搜索进行中发起新搜索

## 5. 测试验证

- [x] 5.1 前端构建成功
- [x] 5.2 无 linter 错误
