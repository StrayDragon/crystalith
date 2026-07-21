## 决策

1. **存储**：写入 `sources.metadata.autoSummary`（JSON），与 parser metadata 并存；更新时 merge，禁止整表覆盖丢掉既有键。
   ```json
   {
     "autoSummary": {
       "summary": "...",
       "keyPoints": ["..."],
       "topics": ["..."],
       "wordCount": 14,
       "generatedAt": "2026-07-21T02:00:00.000Z"
     }
   }
   ```
2. **GET 无副作用**：只读 DB；可从 chunks 计算 `wordCount`（无 LLM）。无 `autoSummary` → 200 + 空态（`summary: ""`，`keyPoints/topics: []`，`generatedAt: null`）。
3. **POST 有副作用**：与现 GET 相同的 prompt/parse 逻辑抽出共享函数；成功后 merge 写入 metadata 并返回完整摘要。
4. **预生成时机**：`pipeline`（及等价 ready 路径）在 mark `ready` **之后** fire-and-forget；**不**阻塞 upload 响应。失败仅打日志，下次打开可点「生成摘要」。
5. **UI**：
   - 无缓存：提示「尚未生成自动摘要」+ 按钮 **生成摘要**
   - 有缓存：保留现有折叠区；右上角 **刷新图标** = POST 重新生成（loading 时 disabled / 转圈）
   - 文案按钮「重新生成」不另增，避免与刷新图标重复

## 非目标

- 独立 DB 列 / 迁移表
- 批量回填历史来源的后台 job（可后续）
- 改变摘要 prompt 质量本身
- 为 summary 引入 SSE 流式

## 风险

- metadata 并发写：ingest 写 parser metadata 与异步 summary 写需 read-merge-write；以 source id 串行或乐观 merge。
- ready 后异步与用户立刻打开详情竞态：GET 可能短暂空态，UI 显示生成按钮；若异步稍后完成，下次打开或可轮询/再 GET（首版：用户刷新详情或点生成即可，不做长轮询）。
