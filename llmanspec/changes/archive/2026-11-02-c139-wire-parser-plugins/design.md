# Parser 接线设计

## 现状缺口

```
CrystalithPlugin kind=parser     features/sources/parser-registry.ts
  （union 有、ingestion 不读）  ←── pipeline.ts 启动时 registerParser
                                      pdf/html/csv/text
```

extractor 已迁完：impl 模块仍在 `shared/extraction/*`，builtin 包装进 registry，编排层只读 `loadedByKind('extractor')`。parser 抄这条，不新造第三张表。

## D1 — 插件 id vs wire parserType

与 extractor 相同：

| 层                                         | 例                           |
| ------------------------------------------ | ---------------------------- |
| 插件 id（`plugins.enabled` / diagnostics） | `parser-text`、`parser-docx` |
| wire `Parser.id` / 来源行 `parserType`     | `text`、`docx`               |

派生：去掉 `parser-` 前缀。存量 `parser_type` 列不改。r257 的 `parser_plugin_id` 写入 `source.metadata.parserPluginId`（不加新列，避免本 change 做 drizzle 迁移）。

## D2 — 编排层收口，不删 Parser 接口

保留 `Parser` `{id,name,mimeTypes,extensions,parse}`。builtin factory 返回该对象。`listParsers` / `selectParser` / `getParser` 改为读 `pluginRegistry`（须先 `ensureLoaded`），模块级 `Map` 删除。pipeline 去掉 import-time `registerParser`。

选择顺序（兑现 r257）：

1. 显式 `parserType` → `getParser(wireId)`，未装载则 415。
2. 否则在 **已装载** parser 上：MIME 精确匹配，再扩展名匹配。
3. 多插件命中同一输入：`plugins.load_order` 列表中后出现者优先；都未列入则 `plugin.id` 字典序。
4. 无人命中 → 415 + `pluginHint: parser-<ext>`（r295 已有，docx 从此可被真实插件消掉）。

core-only 底线（r258）仍由 builtin `parser-text` + `parser-csv` 保证；`parser-pdf` / `parser-html` 继续作为官方 builtin（本 change 不把它们赶出盒子）。docx 是第一份外部格式。

## D3 — `parser-docx` 榜样

- 包：`packages/plugin-parser-docx`，npm 名 `@crystalith-plugin/parser-docx`，根 `devDependencies` `workspace:*`（与 extractor-arxiv 相同，免发包即可被 discovery 命中）。
- 依赖：`mammoth`（纯 JS）。禁止 native addon。
- MIME：`application/vnd.openxmlformats-officedocument.wordprocessingml.document`；扩展名 `.docx`。旧 `.doc` 不承诺（mammoth 主路径是 docx）。
- `parse`：bytes → `{ text }`，正文为 markdown（mammoth `convertToMarkdown`）。失败抛结构化错误（errorCode/message，可选 filename）。
- 调试：`packages/plugin-parser-docx/scripts/try.ts` 读一个本地 docx，免启服。
- 单二进制：mammoth 是纯 JS；接入后仍须 `just build-binary` 冒烟（AGENTS 守则）。若 mammoth 顶层 `require` JSON 踩到 bun compile 坑，按 `build-binary.ts` 既有插件模式内联，不改契约。

## D4 — 清单与诊断

- `GET /v2/sources/parsers`：仅已装载项；条目加法 `pluginId`（可选，Zod `.optional()`）。
- denylist / 未 allowlist / factory 失败 → 不出现在 parsers 清单，记入 `diagnostics.plugins.skipped`（已有 PLUGIN_* 码）。
- 不引入笔记本级 parser 策略（与 extractor 的 inherit_global/custom 分开）。启用仍是 `config/app.yaml` `plugins.*` 运维边界。

## D5 — 规格落点

新 `parser-plugins` 是 kind 层 SSOT（对照 `web-extractor-plugins`）。r16 把「extractor 与 slides-workflow 内建」扩成含 parser；output-type 继续 DEFERRED，本 change 不碰 `OUTPUT_META`。ingestion 选择/415 的 canonical 仍在 source-ingestion-*，本 capability 用引用语，不复制选择算法。

## 测试 seam（复用既有 harness）

| seam                    | 既有入口                                                  |
| ----------------------- | --------------------------------------------------------- |
| registry 装载 / skip    | `apps/server/tests/plugins/registry.test.ts`              |
| 选择 + 415 + parserType | `apps/server/tests/sources/parser-selection.test.ts`      |
| 上传契约 / GET parsers  | `apps/server/tests/sources/upload-contract.test.ts`       |
| 扁平 parsers 路径       | `apps/server/tests/api-contract/contract-surface.test.ts` |
| docx 榜样（新增）       | `apps/server/tests/plugins/parser-docx.test.ts`           |
