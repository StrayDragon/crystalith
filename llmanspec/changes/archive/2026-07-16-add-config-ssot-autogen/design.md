# add-config-ssot-autogen — Design Decisions

## 1. 为什么选择 Zod 作为 SSOT 而非 YAML/JSON

| 方案                 | 优点                                                                                                       | 缺点                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **Zod** (已选)       | 与项目现有 schema 体系一致；TypeScript 类型自动推导；`zod-to-json-schema` 生态成熟；`.describe()` 原生支持 | 非技术成员查看 schema 需要懂 TS                |
| YAML schema 文件     | 非技术成员可读                                                                                             | 需要额外维护同步；无类型推导；需要单独的工具链 |
| JSON schema 手动维护 | 编辑器原生支持                                                                                             | 重复劳动；必定漂移                             |

选择 Zod 的核心理由：**项目已有 15+ 个 Zod schema 文件在 `packages/shared/src/schemas/` 下**，再新增一个 env schema 是自然延伸。

## 2. Env Schema 分组设计

```
packages/shared/src/schemas/env.ts
├── EnvTarget enum         — 'build-run' | 'secrets'
├── BuildRunEnvSchema      — → .env 文件
│   ├── CL_SERVER_PORT     (z.coerce.number().default(8032))
│   ├── CL_SERVER_HOST     (z.string().default('127.0.0.1'))
│   ├── CL_DATA_ROOT       (z.string().default('./data'))
│   └── ...                (非敏感 build/run 参数)
└── SecretsEnvSchema       — → config/secret.env
    ├── CL_CHAT_API_KEY    (z.string().default(''))
    ├── CL_EMBEDDING_API_KEY (z.string().default(''))
    └── ...                (API keys, tokens)
```

### 非 CL_* 变量处理

- `SEARXNG_HOST`、`POSTGRES_PASSWORD` 等向后兼容 fallback 在 schema 中以 `/* @deprecated Use CL_* variant */` 注释标记
- 生成 `.example` 文件时：非 CL_* 变量放在文件末尾的 `# --- Deprecated ---` 区域

### 变量来源

现有 env var 完整列表通过 `grep -rn "process.env\.\|env\."` 仓库扫描得到，包括：

**build-run (.env)**:

- `CL_SERVER_PORT`, `CL_SERVER_HOST`, `CL_DATA_ROOT`, `CL_DB_PATH`, `CL_CONFIG_PATH`, `CL_SECRET_PATH`
- `CL_SEARXNG_HOST`, `CL_DEFAULT_CHAT_MODEL`, `CL_DEFAULT_EMBEDDING_MODEL`, `CL_CHAT_API_BASE`, `CL_EMBEDDING_API_BASE`, `CL_EMBEDDING_MODEL`, `CL_CHAT_LIGHT_MODEL`, `CL_CHAT_MODEL`
- `OPENAI_BASE_URL`, `VITE_API_PROXY_TARGET`
- `SEARXNG_HOST` (deprecated), `POSTGRES_PASSWORD` (deprecated), `JINA_API_KEY` (deprecated), `FIRECRAWL_API_KEY` (deprecated), `BROWSERLESS_TOKEN` (deprecated)

**secrets (config/secret.env)**:

- `CL_CHAT_API_KEY`, `CL_EMBEDDING_API_KEY`
- `CRYSTALITH_API_KEY` (commented out in app.yaml)

## 3. JSON Schema 生成策略

`config/app.yaml` 的 Zod schema 散布在 `config.ts` 中（~15 个独立的 schema）。生成 JSON Schema 时：

- 只生成 **顶级段落** 的 schema（`app`、`models`、`embedding`、`concurrency`、`storage`、`search`、`optional_services`、`source_ingestion`、`plugins`、`providers`、`cache`、`database`、`context_window`、`vector_storage` 等）
- 每段落的 schema 名 = YAML 段落名（PascalCase → snake_case 映射）
- 使用 `zod-to-json-schema` 的 `zodToJsonSchema()` 转换
- 生成的文件添加 `$schema` 自引用和 `title`/`description` 元信息

## 4. Drift 检测策略

两种检测模式：

| 门禁                     | 触发时机   | 检测方法                        |
| ------------------------ | ---------- | ------------------------------- |
| `check-env-examples`     | pre-commit | 生成到 tempdir，与现有文件 diff |
| `gen-app-schema --check` | CI         | 生成到 tempdir，与现有文件 diff |

临时文件写入 `os.tmpdir()`，不会污染工作区。

## 5. 预留给 c13 的边界

- `config/secret.env` 的实际值校验（非空检查、URL 格式校验等）不在本次范围内
- `config/app.yaml` 的 Nunjucks 模板渲染逻辑不变
- `scripts/init_config.sh` 仍保留，但 keys 列表改为引用 SSOT（通过 `llman sdd` 或直接读取 schema 元信息）

## 6. 依赖

- `zod-to-json-schema` v3+ 作为 devDependency 添加到 `packages/shared` 或 workspace root
- 生成脚本用 Bun TypeScript 运行，不需要额外编译步骤
