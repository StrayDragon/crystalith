# fix-v2-qa-citations — Tasks

## 1. 修复 retrievedChunks 回填 (P0)

- [ ] `features/qa/handler.ts`: streamText fullStream 捕获 `tool-result` 事件回填 retrievedChunks（或闭包 push）
- [ ] 复用 `ai/tools/retrieve-sources.ts` 的 retrieveSourcesTool 替换内联简化版
- [ ] 验证: QA 请求后 citations 数组非空

## 2. source_name hydrate

- [ ] 确认 retrieveSourcesTool 查 sources 表填充 source_name（非 "Source ${id}" 占位）
- [ ] 验证: citation.source_name 为真实文件名

## 3. 接入 ragRegistry

- [ ] `features/qa/handler.ts`: 用 ragRegistry.getForNotebook() 替换 `new EmbedStrategy()`
- [ ] honors 请求的 strategy_id 参数
- [ ] 验证: 配置 hybrid 策略后 QA 使用 hybrid 检索

## 4. 置信度计算

- [ ] 新建 `features/qa/confidence.ts`: computeConfidence (sim_avg + coverage + citation)/3
- [ ] `ai/stream.ts`: done 事件携带 confidence
- [ ] 验证: 有证据时 confidence > 0

## 5. 无证据本地化提示

- [ ] `features/qa/handler.ts`: 无证据时按原因返回中文提示（移植 v1 service.py:62）
- [ ] 验证: 无来源时返回"请先选择至少一个来源后再提问"

## 6. 整体验证

- [ ] `cd apps/server && bun test test/qa/`（引用回填 + 置信度单元测试）
- [ ] `bun oxlint apps/server/src/features/qa/`（0 error）

## Verification

```bash
cd apps/server
bun test test/qa/    # citations 非空、source_name 真实、置信度正确、无证据提示
bun oxlint apps/server/src/features/qa/
```
