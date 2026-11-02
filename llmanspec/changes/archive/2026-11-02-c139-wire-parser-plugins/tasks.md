# Tasks — parser 接线并对外

- [x] T1 core parser 改 builtin 并让 ingestion 只读 registry
  - `parser-pdf` / `parser-html` / `parser-csv` / `parser-text` 包装进 `builtinPlugins`；删 pipeline import-time `registerParser`；`listParsers`/`selectParser`/`getParser` 改读 `loadedByKind('parser')`。
  - 验证：`bun test --parallel apps/server/tests/plugins/registry.test.ts apps/server/tests/sources/parser-selection.test.ts apps/server/tests/sources/upload-contract.test.ts apps/server/tests/api-contract/contract-surface.test.ts`
  - [blocked-by: ]

- [x] T2 `@crystalith-plugin/parser-docx` 榜样 + 上传通路
  - monorepo 包 + mammoth + 根 workspace 依赖；`.docx` 摄取 ready、`parserType=docx`、`metadata.parserPluginId=parser-docx`；denylist/未装时 415 且 `pluginHint=parser-docx`。
  - 验证：`bun test --parallel apps/server/tests/plugins/parser-docx.test.ts apps/server/tests/sources/parser-selection.test.ts apps/server/tests/sources/upload-contract.test.ts`
  - [blocked-by: T1]

- [x] T3 对外承诺与诊断
  - `GET /v2/sources/parsers` 透出已装载 parser（含可选 `pluginId`）；`diagnostics.plugins.loaded` 含 `parser-docx`（安装时）与四个 builtin；更新 `docs/plugins.md`（parser 为第二种开放 kind，slides/output-type 仍关闭）。
  - 验证：`bun test --parallel apps/server/tests/api-contract/workspace-tools-discovery.test.ts apps/server/tests/api-contract/contract-surface.test.ts`
  - [blocked-by: T2]

- [x] T4 门禁
  - `just qa` 全绿。docx 接入后按 AGENTS 守则补 `just build-binary` 启动冒烟（`/health` + 建笔记本 + 上传一个最小 docx）。
  - [blocked-by: T3]
