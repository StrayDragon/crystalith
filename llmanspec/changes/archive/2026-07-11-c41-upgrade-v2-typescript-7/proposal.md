---
depends_on: []
batch: standalone
---

# c41-upgrade-v2-typescript-7 — TypeScript ^5 → ^7 升级

## Why

typescript@7.0.2 内置 Go 原生编译器（tsgo），类型检查 ~10x 加速。无需单独安装 `@typescript/native-preview` 包 — `typescript@^7` 的 `tsc` 命令本身就是 Go 二进制，CLI 接口完全兼容（`--noEmit`、`-p` 等 flag 不变）。

当前三个 workspace 各自声明 `typescript: ^5` 或 `^5.9.2`（均 resolve 到 5.9.3），升级到 `^7` 即可自动获得加速。

## What Changes

### 依赖升级（3 个 package.json）

| 文件                         | devDeps 旧值             | 新值                 |
| ---------------------------- | ------------------------ | -------------------- |
| apps/server/package.json     | `"typescript": "^5"`     | `"typescript": "^7"` |
| apps/web/package.json        | `"typescript": "^5.9.2"` | `"typescript": "^7"` |
| packages/shared/package.json | `"typescript": "^5"`     | `"typescript": "^7"` |

### tsconfig 统一整理

- `moduleResolution`: web `tsconfig.json` 用 `"Bundler"`（大写），web `tsconfig.node.json` 用 `"Bundler"`，server/shared 用 `"bundler"` → 统一为小写 `"bundler"`
- 验证 `allowImportingTsExtensions`、`verbatimModuleSyntax`、`paths` 在 TS 7.0 正常工作

### 类型错误修复（预期少量）

TS 7.0 可能收紧部分检查。已知风险点：

- Elysia 重度类型推断
- Drizzle ORM 条件类型
- web 的 vendored `rivu-*` 路径别名（tsgo 解析行为需验证）
- `@types/bun` 兼容性

## Capabilities

- architecture-core (工具链版本约束)

## Impact

- **~10x 类型检查加速**（Go 原生二进制 vs JS V8）
- 安装体积相当（~30MB 平台二进制 vs ~60MB JS）
- CLI 接口不变，无破坏性变更
- 回退方案：`git checkout` 回 `^5` 即可
