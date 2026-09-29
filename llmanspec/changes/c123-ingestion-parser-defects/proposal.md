---
depends_on: []
---

# 摄取解析真缺陷修复：parser 选择确定性 + 不支持格式 415 + Markdown 预处理

## Why

F 批七条 bare 规则的代码核查升级出**三个真实缺陷**（复现坐实，非纸面推断）：

1. **r257 选择不可判定且覆盖失效**：`selectParser` 的 MIME 前缀匹配按注册序取首个 `application/*`——PDF parser 最先注册，导致**一切 `application/*` 输入（xml、octet-stream、任意未知二进制）全部误配 PDF parser**；显式 `parserType` 覆盖把 id 误当 MIME 查询，除意外落到默认回退外**从不生效**。c120 记录的「.txt 误配 html」线索经复现修正为上述真根因（.txt/.md 今日命中 text，受害的是 application/* 与无扩展名输入）。
2. **r258/r295 拒绝语义缺失（现行违约）**：未知格式不走「稳定的不支持语义」，而是静默喂给 PDF/text parser 产出垃圾分块；规格要求的 415 + 机器可读诊断（含 `parser-*` 恢复提示）完全不存在。
3. **r287/r464/r465 Markdown 预处理缺失**：wikilink/embed 原样进 chunker（`[[page|alias]]` 沦为不可检索的字面文本），frontmatter 不提取、还污染分块内容。

另有 **r52（document_parse 任务）**：v2 无任务队列基建（pipeline 有意同步），规则是 v1 词汇残留——按「实现 or 改写」原则改写为字节持久化合约（该半边已实现：ingest 时 `contentStorage.save`）。

## What Changes

- **parser-registry**：`selectParser` 移除前缀匹配与 text 默认回退 → 精确 MIME 匹配（注册序确定性）→ 扩展名匹配 → `undefined`；显式覆盖改走 `getParser(id)`；未知/不匹配返回 `undefined` 由管线拒绝。
- **pipeline**：无匹配 parser → `415 UNSUPPORTED_MEDIA_TYPE`（errors.ts 新增 ErrorCode + 415 映射），`details` 携带 `mimeType/filename/pluginHint`（`parser-<ext>` 形式）；显式 parserType 未知 → 同 415 语义。插入点在 source 行创建之前（无脏行）。
- **markdown-preprocess**（新模块，parse→chunk 之间）：`[[t|a]]`→`[a](t)`、`[[t]]`→`[t](t)`；embed `![[t]]`→图片扩展走 `![t](t)`、其余转链接；YAML frontmatter 解析 `title/tags/aliases/date` 写入 `source.metadata.frontmatter` 并从分块文本剥离；无 frontmatter/无 wikilink 的文件零扰动。
- **specs 收口**：r257/r258/r295/r287/r464/r465 六条场景化；r52 改写为「原始字节持久化可再解析」合约 + 场景（锁定规则改写，报告制）。pending 79 → 72。
- **URL 摄取路径不受影响**（固定 text/html 精确命中；link 模式直插行）。

## Impact

- **行为变更**：未知格式上传从「垃圾 200」变为 415——这是修复违约而非破坏合约。
- parser 选择矩阵变化：`.xml`/octet-stream/无扩展名不再误配 PDF。
- 无 wire 字段变更；`source.metadata.frontmatter` 为新增可选字段。
