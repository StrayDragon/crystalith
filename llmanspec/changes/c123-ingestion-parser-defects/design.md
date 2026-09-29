# Design — 摄取解析真缺陷修复

## 复现记录（r257 真根因，修正 c120 线索）

注册序 pdf → html → csv → text。`selectParser` 三段逻辑的实际行为：

| 输入 | 现行为 | 根因 |
| --- | --- | --- |
| `.txt` → text/plain | text ✓ | 精确匹配命中 text（注册序内 text 最后，但精确匹配无竞争） |
| `.md` → text/markdown | text ✓ | 同上 |
| **`.xml` → application/xml** | **pdf ✗** | 精确无匹配；前缀段 `application/xml`.startsWith(`application/`) → **pdf 最先注册即赢** |
| **octet-stream / 无扩展名** | **pdf ✗** | 同上 |
| **显式 parserType='pdf'** | **text ✗** | `selectParser(input.parserType)` 把 id 'pdf' 当 MIME 查 → 全段落空 → 默认回退 text |

结论：前缀匹配（`mimeType.startsWith(m.split('/')[0] + '/')`）与 text 默认回退是两个必须移除的错误设计；显式覆盖需独立按 id 解析。

## parser-registry 新语义

```
selectParser(mimeType?, filename?):
  1. 精确 MIME（注册序，确定性）
  2. 扩展名（注册序）
  3. undefined —— 交由管线按 r258/r295 拒绝
getParser(id)：显式 parserType 覆盖的唯一入口（id 即 registry key）
```

SHOULD 记录 `parser_plugin_id`：无插件系统（r166 已确认静态注册表现实），随 r257 场景措辞按 core 注册序口径落地。

## 415 语义（r258/r295）

- `errors.ts`：`ErrorCode.UNSUPPORTED_MEDIA_TYPE = 'UNSUPPORTED_MEDIA_TYPE'`，`STATUS_BY_CODE` 映射 415。既有 errors 测试按例映射新增断言。
- pipeline 判定点**先于** source 行创建（沿用 r290 的确定性输入错误范式，无脏行）；`details: { mimeType, filename, pluginHint }`，`pluginHint = parser-<ext 去点>`（有扩展名时）——r295 的「可机器读取恢复提示」。
- 错误信息面向用户：`Unsupported file type: <mimeType|ext>（可安装对应 parser 插件）`。

## Markdown 预处理（r287/r464/r465）

新模块 `features/sources/markdown-preprocess.ts`，pipeline 在 parse 之后、chunk 之前调用（仅当 mimeType ∈ {text/markdown, text/x-markdown} 或扩展名 .md/.markdown）：

- **wikilink 归一**（r464）：`[[target|alias]]` → `[alias](target)`；`[[target]]` → `[target](target)`；embed `![[target|alias]]` → 图片扩展（png/jpg/jpeg/gif/svg/webp）→ `![alias](target)`，否则 `[alias](target)`（转成可检索文本引用）。
- **frontmatter 提取**（r465）：仅识别文档头部 `---\n…\n---`；支持字段 `title`（字符串）、`tags`/`aliases`（内联数组或 `- ` 列表）、`date`（ISO 字符串）——最小容错解析，不引入 YAML 依赖；写入 `source.metadata = { ...existing, frontmatter }`（parse 完成后 update 行），**剥离后的正文才进 chunker**。
- **零扰动保证**：无 frontmatter 且无 wikilink 的 markdown、非 markdown 输入，文本逐字节不变。

## r52 改写（锁定规则改写，报告制）

「document_parse 任务」是 v1 任务队列词汇；v2 pipeline 有意同步（源码注释明示 desktop MVP 无 job queue），且无任何 UI/CLI 消费者。改写为已实现半边的合约：**ingest MUST 持久化原始字节（contentStorage），来源 MUST 可经其读回原始内容以支持再解析**；场景锚 `contentStorage.read(sourceId)` 往返断言。队列化 re-parse 若未来需要，届时新立 capability。

## 测试 seam

`apps/server/tests/sources/parser-selection.test.ts`（新，integration）：选择矩阵（复现表逐行断言）+ 415 分支（未知扩展/未知 parserType/octet-stream）+ parserType 记录 + markdown 预处理三合一用例（wikilink 归一断言 chunk 文本、frontmatter 断言 metadata）+ 零扰动对照 + r52 字节往返。既有 `empty-input-rejection`（.txt 路径）与 csv-parser 测试不受扰动，全量回归兜底。
