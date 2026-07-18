## 决策

1. **List DTO 瘦身**：list 响应 item MUST NOT 包含完整 generation payload / 长 markdown；可用 `preview`（截断）可选。
2. **Detail on demand**：点击/选中时 `GET` 单条拉全量；内存缓存避免反复请求。
3. **与分页兼容**：建立在 c68 `PaginatedSchema` 之上；若 c69 已嵌套则走嵌套 path。

## 非目标

- 虚拟滚动大重构（可后续）
- 改变输出渲染器本身
