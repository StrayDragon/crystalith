---
depends_on: []
batch: false
---

# add-config-ssot-autogen — 配置 SSOT 自动生成体系

## Why

当前配置管理存在两处"生成的产物靠手工维护"的问题：

1. **环境变量 `.example` 文件**：`.env.example` 和 `config/secret.env.example` 是手工编写的注释 + 空白值文件，新增 env var 需要在 3-4 个地方同步修改（example 文件、init_config.sh、config.ts、docs），容易遗忘导致漂移。

2. **YAML 配置 JSON Schema**：`config/app.yaml` 第一行已声明 `$schema=./app.schema.gen.json`，但该文件**不存在**——VSCode / Neovim 等编辑器没有 schema 补全和校验。

两个问题本质相同：**业务逻辑的 SSOT（Zod schema）已经有了，但生成式产物没有实现自动同步**。

## What Changes

### A. 环境变量 Zod Schema SSOT

- **NEW** `packages/shared/src/schemas/env.ts` — 统一的 Zod schema 定义所有环境变量
  - 按 `build-run`（`.env`）和 `secrets`（`config/secret.env`）分组
  - 每个字段包含 `.describe()` 中文描述、默认值、类型信息
  - 作为唯一定义源，消除 `init_config.sh`、`.example` 文件、config.ts 三者之间的碎片化

### B. `.example` 文件自动生成脚本

- **NEW** `scripts/gen-env-examples.ts` — 从 Zod schema 读取，生成两个文件：
  - `.env.example`（build-run 组）
  - `config/secret.env.example`（secrets 组）
  - 包含完整的注释头、每个字段的中文描述、空白值行

### C. YAML JSON Schema 自动生成

- **NEW** `scripts/gen-app-schema.ts` — 从 `config.ts` 中的 Zod schema（`AppSettingsSchema`、`AiSettingsSchema`、`ConcurrencySettingsSchema` 等）生成 `config/app.schema.gen.json`
  - 使用 `zod-to-json-schema` 库
  - 每个字段携带 `.describe()` 中文描述
  - 支持 `--check` 模式检测漂移

### D. Justfile + Pre-commit 集成

- **NEW** `just gen-env-examples` — 重新生成 `.env.example` + `config/secret.env.example`
- **NEW** `just gen-app-schema` — 重新生成 `config/app.schema.gen.json`
- **NEW** `just check-env-examples` — drift 检测（退出码 0/非零）
- **MOD** `.pre-commit-config.yaml` — 新增 `check-env-examples` hook
- **MOD** `scripts/init_config.sh` — 引用 SSOT schema 而非自己维护 key 列表

## Capabilities

- configuration-governance (delta ops r9–r11)

## Impact

- 仓库新增 3 个源文件、1 个依赖（`zod-to-json-schema`）
- 首次运行 `just gen-env-examples` 和 `just gen-app-schema` 会生成/覆盖 `.example` 和 `.schema.gen.json` 文件
- `.env.example` 内容会重新生成，但内容应一致（注释风格可能微调）
- `.pre-commit-config.yaml` 新增一个本地 hook，降低提交速度可忽略
- 无运行时行为变化（生成的文件仅在开发/CI 时使用）
