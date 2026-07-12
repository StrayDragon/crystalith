# fix-v2-sources-citations-contract — Tasks

## 1. qa-to-source 多轮 messages (P1)

- [ ] `features/sources/source-extras.router.ts:228-231`: 接受 `messages: list[QAMessage]` 多轮历史（对齐 v1 api_qa.py:186-209,204-209）
- [ ] 格式化为完整 transcript 后转换
- [ ] 保留单轮 {question, answer} 向后兼容（或在 schema 里两者择一）
- [ ] 验证：多轮历史可转换

## 2. tag 绑定 per-item 诊断 (P1)

- [ ] `features/sources/router.ts:447,461,488`: 批量 assign/remove 返回 `results[]`（per-item {source_id, ok, message, error_code}，对齐 v1 api_tags.py:180-184）
- [ ] 缺失 source 不再静默 continue，报 SOURCE_NOT_FOUND
- [ ] 验证：批量绑定中缺失 source 时 results 含失败项

## 3. CSV parser 转义 (P1)

- [ ] `features/sources/parsers/csv.ts:64-67,70-76`: 转义 `|`→`\|`、换行转义、截断用 `…`（对齐 v1 csv.py:61-67）
- [ ] 验证：含 `|` 或换行的单元格不破坏 markdown table

## 4. citations /context 路径修正 (P1, BREAKING)

- [ ] `features/citations/router.ts:35,50`: 路径改回 `/v2/notebooks/:nid/citations/context`（对齐 v1 api.py:13 与 c26 proposal.md:20/design.md:6）
- [ ] notebook_id 从 query param 改为 path param
- [ ] 前端调用路径同步更新（apps/web）
- [ ] 验证：/v2/notebooks/:nid/citations/context 可用；扁平路径不再命中

## 5. citations 默认 before/after=1 (P1)

- [ ] `features/citations/router.ts:89-90`: before/after 默认改 1（对齐 v1 api.py:61-62 Query(1, ge=0, le=5)）
- [ ] 验证：省略参数时返回 1 before + 1 after

## 6. connector config JSON-schema 校验 (P1)

- [ ] `features/source-connectors/connectors.ts`: 每个 built-in connector 声明 connection_config 的 JSON schema（对齐 v1 plugins.connection_config_schema）
- [ ] `features/source-connectors/router.ts:232-241`: 创建 binding 时校验 connection_config（Zod 或等价），非法 → 400（对齐 v1 api.py:77-98,199-200 Draft7Validator）
- [ ] 验证：畸形配置 → 400

## Verification

```bash
cd apps/server && bun typecheck   # MUST pass
cd apps/server && bun test        # sources/citations 相关测试 MUST pass，无回归
cd apps/web && bun run typecheck  # 前端 citations 路径更新后 MUST pass
```

人工：

- qa-to-source 多轮可转换
- tag 批量绑定 results 含 per-item 诊断
- CSV 含 `|`/换行正确转义
- citations /context 走层级路径；默认 1/1
- connector 畸形 config → 400
