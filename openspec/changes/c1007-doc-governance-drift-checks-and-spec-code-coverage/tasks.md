## 1. CI 基线（PR + main）

- [ ] 1.1 统一 CI 触发（`push` main + `pull_request`），并按需忽略纯 docs/openspec 变更以节省资源（不牺牲 drift checks 的覆盖）
- [ ] 1.2 后端 job：`cd backend/py && uv sync --frozen` → `just lint` → `just typecheck` → `just test`（或等价入口）
- [ ] 1.3 前端 job：`cd frontend/web && pnpm install --frozen-lockfile` → `pnpm run test:ci` → `pnpm run lint` → `pnpm run format:check` → `pnpm run typecheck` → `pnpm run build`
- [ ] 1.4 Drift checks job（可并入现有 jobs 或单独 job）：
  - docs drift / doc governance check
  - openspec validate（changes/specs）
  - OpenAPI/client drift（引用 `c2021`，例如 `pnpm -C frontend/web run api:sync` 的 diff 检查或等价 gate）
  - config schema drift（例如 `cd backend/py && just config-schema` 后 diff 检查）
  - import layering（如仓库已有 gate 则纳入）

## 2. 覆盖率与质量信号

- [ ] 2.1 后端覆盖率：启用/复用 `pytest-cov`（例如 `just coverage`），上传 coverage artifact
- [ ] 2.2 前端覆盖率：启用 Vitest coverage（v8），上传 coverage artifact
- [ ] 2.3 可选：PR 评论展示覆盖率摘要（先总覆盖率即可）

## 3. 依赖漏洞扫描

- [ ] 3.1 Python 依赖漏洞扫描（`pip-audit` 或同类工具）：PR + 每周定时
- [ ] 3.2 Node.js 依赖漏洞扫描（`pnpm audit` 或同类工具）：PR + 每周定时
- [ ] 3.3 输出至少一种可消费形式（artifact 或 PR 摘要）

## 4. 缓存与性能

- [ ] 4.1 CI 启用依赖缓存：uv cache + pnpm store
- [ ] 4.2 失败诊断输出中包含“缓存命中/未命中”提示（如可用）

## 5. 分支保护与文档

- [ ] 5.1 main 分支保护建议：禁止直接 push、required checks、最少 review 数
- [ ] 5.2 README/贡献指南补齐：本地对齐命令、required checks 清单与排障入口
- [ ] 5.3 可选：CI status badge（如仓库定位需要）

## 6. Spec ↔ code ↔ tests coverage map

- [ ] 6.1 生成最小 doc/spec/code link index（capability ↔ code paths ↔ verification commands）
- [ ] 6.2 区分人工确认链接 vs 系统推断链接，并确保推断不会被当作硬事实
- [ ] 6.3 输出 coverage map：哪些 spec 没有测试、哪些模块缺 spec

## 7. 验证

- [ ] 7.1 PR 上 required checks 稳定触发且不与现有 workflows 冲突
- [ ] 7.2 drift checks 失败输出可定位且能指向可执行修复命令
