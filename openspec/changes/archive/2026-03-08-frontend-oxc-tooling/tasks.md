## 1. OpenSpec 与基线确认

- [x] 1.1 创建独立 change `frontend-oxc-tooling`，并补齐 proposal/design/spec delta。
- [x] 1.2 记录当前前端基线：`Biome lint --changed` 可运行，`Biome lint ./src` 存在大量历史诊断，便于后续对比迁移效果。

## 2. 前端工具链迁移

- [x] 2.1 用 `oxlint` / `oxfmt` 替换 `frontend/web/package.json` 中的前端 lint/format 入口，并移除 `@biomejs/biome` 与 `eslintConfig` 残留。
- [x] 2.2 新增 `.oxlintrc.json`、`.oxfmtrc.json` 与增量 lint helper，覆盖插件启用、忽略路径与 changed-files 逻辑。
- [x] 2.3 对前端受管源码与关键配置执行一次全量 `oxfmt` 收敛。

## 3. 文档与验证

- [x] 3.1 更新 `AGENTS.md`、`frontend/web/AGENTS.md`、`docs/content/contributing.md`、`openspec/config.yaml` 中关于前端 lint/format 的描述。
- [x] 3.2 运行并记录验证：`pnpm run lint`、`pnpm run lint:all`、`pnpm run format:check`、`pnpm typecheck`、`pnpm test --run`、`pnpm run build`。

## Verification

- `cd frontend/web && pnpm run lint`
  - 结果：退出码 0；增量 `oxlint` 成功识别当前工作区改动并输出 warning（无 error）。
- `cd frontend/web && pnpm run lint:all`
  - 结果：退出码 0；全量 `oxlint` 对 `src/` 运行成功，当前仓库基线存在 240 条 warning、0 条 error。
- `cd frontend/web && pnpm run format:check`
  - 结果：退出码 0；`oxfmt` 确认所有受管文件已符合格式。
- `cd frontend/web && pnpm typecheck`
  - 结果：退出码 0。
- `cd frontend/web && pnpm test --run`
  - 结果：退出码 0；26 个测试文件、111 个测试通过。
- `cd frontend/web && pnpm run build`
  - 结果：退出码 0；Vite 生产构建成功。
