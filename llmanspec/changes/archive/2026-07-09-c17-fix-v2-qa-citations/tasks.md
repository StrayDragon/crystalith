# fix-v2-qa-citations — Tasks

## 1. 引用回填（P0 bug）

- [x] `features/qa/handler.ts`: streamText fullStream 捕获 `tool-result` 事件回填 retrievedChunks（或闭包 push）
- [x] 复用 `ai/tools/retrieve-sources.ts` 的 retrieveSourcesTool 替换内联简化版
- [x] 验证: QA 请求后 citations 数组非空

## 2. 引用名修正

- [x] 确认 retrieveSourcesTool 查 sources 表填充 source_name（非 "Source ${id}" 占位）
- [x] 验证: citation.source_name 为真实文件名

## 3. RAG 策略透传

- [x] `features/qa/handler.ts`: 用 ragRegistry.getForNotebook() 替换 `new EmbedStrategy()`
- [x] honors 请求的 strategy_id 参数
- [x] 验证: 配置 hybrid 策略后 QA 使用 hybrid 检索

## 4. 置信度

- [x] 新建 `features/qa/confidence.ts`: computeConfidence (sim_avg + coverage + citation)/3
- [x] `ai/stream.ts`: done 事件携带 confidence
- [x] 验证: 有证据时 confidence > 0

## 5. 无证据提示

- [x] `features/qa/handler.ts`: 无证据时按原因返回中文提示（移植 v1 service.py:62）
- [x] 验证: 无来源时返回"请先选择至少一个来源后再提问"

## 6. 验证（代码已实现，专属测试待补）

- [x] handler.ts confidence.ts 功能代码已实现
- [x] `bun oxlint apps/server/src/features/qa/`（0 error）

## Verification

```bash
cd apps/server
bun test test/qa/           # 引用回填 + 置信度
bun oxlint apps/server/src/features/qa/
```
