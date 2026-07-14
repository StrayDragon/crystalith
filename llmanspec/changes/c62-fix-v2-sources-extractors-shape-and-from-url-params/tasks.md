# c62 Tasks

## 1. P1-A: extractors 响应形状对齐

- [ ] 1.1 `factory.ts`: listExtractorMetadata 补 `description`（中文）+ `requires_service`（jina/firecrawl=true, readability=false）字段
- [ ] 1.2 `router.ts`: GET /extractors extractor 项补 `type`（=name 别名）+ `enabled`（从 config）+ `description` + `requires_service` + 可选 `error_code/message/details`
- [ ] 1.3 `router.ts`: `default_extractor` 改为按可用性计算（首个 available 的 type），不再硬编码 'readability'

## 2. P1-A: PATCH extractors 校验

- [ ] 2.1 `router.ts`: PATCH 校验 `mode ∈ {inherit_global, custom}`，非法返回 400
- [ ] 2.2 PATCH 校验 `enabled_extractors` 条目 ⊆ 已注册集合，非法返回 400

## 3. P1-B: from-url extractor/mode/snippet

- [ ] 3.1 `router.ts`: from-url 接受 `extractor`（可选），校验值 ∈ 已注册集合，非法 400
- [ ] 3.2 from-url `mode` 改枚举校验 `{fetch, link}`（默认 link），非法 400
- [ ] 3.3 from-url 接受 `snippet`（link 模式），构建内容时使用

## 4. 测试

- [ ] 4.1 `test/sources/extractors-shape.test.ts`: 响应含 type/enabled/description/requires_service；default 按可用性
- [ ] 4.2 `test/sources/extractors-patch-validation.test.ts`: 非法 mode/enabled_extractors 返回 400
- [ ] 4.3 `test/sources/from-url-params.test.ts`: extractor 指定 + mode 枚举校验 + snippet 构建

## 5. spec + 验证

- [ ] 5.1 `llman sdd validate c62-fix-v2-sources-extractors-shape-and-from-url-params` 通过
- [ ] 5.2 `bun test` (server) 通过
- [ ] 5.3 `bun typecheck` (server) ✅
- [ ] 5.4 `bun oxlint` 0 error
