---
title: Parser 宿主接线并对外开放
depends_on: []
branch: sdd/c139-wire-parser-plugins
base_branch: main
base_sha: 6db59bd3d711758a61abd2530fb76ee2684c00cc
---

# Parser 宿主接线并对外开放

本草案实现：ingestion 消费 `pluginRegistry` 的 `parser` kind；core 四件套改为 builtin 插件；`parser-docx` 作为第二种对外 kind 的榜样。TextFold sidecar 与 output-type 不在范围内（见 c140 / c141）。

## Why

- 规格早已按「插件驱动 parser」书写（source-ingestion-core r257、upload r258/r295），但 ingestion 仍走平行的 `parser-registry` 模块表，`CrystalithPlugin` 的 `parser` kind 只存在于 union，宿主不消费。
- `.docx` 上传是研究者真实需求（讲义/论文），415 已经返回 `pluginHint: parser-docx`，指向一个还不存在的包。
- extractor 已证明同一条 registry 路径可对外；parser 是单面契约（bytes → text/pages）、无前端 bundle，适合成为第二种开放 kind。

## What Changes

- core `pdf` / `html` / `csv` / `text` 改为 builtin `CrystalithPlugin`（kind=`parser`），经 `builtinPlugins` 聚合进同一 registry；**禁止**再 `registerParser(...)` 绕过。
- ingestion 与 `GET /v2/sources/parsers` 只看见 `pluginRegistry.loadedByKind('parser')`；选择规则兑现 r257（`plugins.load_order` 后加载者优先，否则 `plugin_id` 字典序）。
- wire `parserType` 保持短 id（`text`/`pdf`/`html`/`csv`/`docx`），由插件 id 去掉 `parser-` 前缀派生——存量行不迁移。
- 新增官方榜样 `@crystalith-plugin/parser-docx`（mammoth，纯 JS）：`.docx` / Word MIME → markdown 正文；未装或 denylist → 415 + `pluginHint: parser-docx`。
- 对外承诺从「仅 extractor」扩到「extractor + parser」；`slides-workflow` / `output-type` 仍不对 npm 开。
- 新 capability `parser-plugins`；修改 architecture-plugin-and-agent r16，把 parser 内建纳入「必须走同一 registry」集合（output-type 仍 DEFERRED）。

## Capabilities

- **parser-plugins**（新增）：kind 层契约——实现形状、装载、清单、core vs 外部、docx 榜样。
- **architecture-plugin-and-agent**（修改 r16）：parser 内建走同一 CrystalithPlugin 路径。
- **source-ingestion-core** r257 / **source-ingestion-upload-and-url** r286/r295/r258：行为已声明，本 change 兑现；场景按 registry 消费补强，不另立平行选择规则。

## Impact

- 行为：`.docx` 从稳定 415 变为可摄取；禁用/未装时 415 语义保持。txt/md/csv/pdf/html 摄取结果不变。
- 契约：`GET /v2/sources/parsers` 仍是 `{id,name,mimeTypes,extensions}`，**加法**可选 `pluginId`（与 extractor 清单对齐）。`parserType` 词汇不改。
- 非目标：笔记本级 parser 策略（extractor 才有）；pptx/xlsx/epub；把 pdf/html 移出 builtin；output-type；TextFold。
- 无 BREAKING。
