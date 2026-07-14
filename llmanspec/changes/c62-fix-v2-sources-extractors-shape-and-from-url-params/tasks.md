# c62 Tasks

## 1. P1-A: extractors 响应形状对齐

- [x] 1.1 `factory.ts`: ExtractorMetadata 加 `type/enabled/description/requires_service` 字段
- [x] 1.2 `factory.ts`: DESCRIPTIONS 表 + requires_service（jina/firecrawl=true）
- [x] 1.3 `factory.ts`: 新增 `getDefaultExtractor(config)` 按可用性计算
- [x] 1.4 `router.ts`: GET /extractors 用 `getDefaultExtractor(config().raw)` 替代硬编码

## 2. P1-A: PATCH extractors 校验

- [x] 2.1 `router.ts`: PATCH 校验 `mode ∈ {inherit_global, custom}`，非法 400
- [x] 2.2 PATCH 校验 `enabled_extractors` 条目 ⊆ 已注册集合，非法 400

## 3. P1-B: from-url extractor/mode/snippet

- [x] 3.1 `router.ts`: from-url 接受 `extractor`（可选），校验值 ∈ 已注册集合，非法 400
- [x] 3.2 from-url `mode` 改枚举校验 `{fetch, link}`（默认 link），非法 400
- [x] 3.3 from-url 接受 `snippet`（link 模式），构建内容时使用
- [x] 3.4 fetch 模式传 extractor order 到 extractUrl

## 4. 测试

- [x] 4.1 `test/sources/c62-extractors-shape.test.ts`: 字段完整性 + requires_service + default 按可用性 (3 tests)

## 5. spec + 验证

- [x] 5.1 `llman sdd validate c62-fix-v2-sources-extractors-shape-and-from-url-params` 通过
- [x] 5.2 `bun test` (server) 通过（278 pass / 0 fail）
- [x] 5.3 `bun typecheck` (server) ✅
- [ ] 5.4 `bun oxlint` 0 error
