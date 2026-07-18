## 1. API 合约

- [ ] 1.1 定义/调整 Output list item schema（无全文）与 detail schema（全文）
- [ ] 1.2 list handler 投影字段；get-by-id 返回完整内容
- [ ] 1.3 测试：list 响应不含大 body；detail 含

验证：`cd apps/server && bun test`

## 2. Frontend

- [ ] 2.1 useOutputQueue / Studio：首屏只依赖 list 摘要
- [ ] 2.2 选中/打开时拉取 detail 并缓存
- [ ] 2.3 Vitest 覆盖懒加载路径

验证：相关 web tests

## 3. 门禁

- [ ] 3.1 `llman sdd validate c72-lazy-load-studio-output-content --strict --no-interactive`
- [ ] 3.2 `just qa`
