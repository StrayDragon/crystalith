# Tasks — c127-deps-refresh-major-minor

> 每批次完成后跑 `just qa`（含 fallow 双门禁）。批次间 commit 分段，禁止跨批混提交。
> 升级一律先改 `package.json` 版本再 `bun install`（让 lockfile 跟随解析），禁止裸 `bun add <pkg>` 无版本重解析（c127 前实测会漂移次要版本炸类型墙）。
> 红批遇阻降级规则：单项超 1 天工时或引入行为回归 → 记 `docs/known-issues.md`，裁出本 change。

## Batch G — 绿批 patch/minor（无 breaking）

- [ ] G1 锁步升 `ai` → 7.x latest；`zod` 4.6.x（apps/server + apps/web + packages/shared 三处 dependencies/devDependencies/peer 同步）
  - 验证：`bun run typecheck` + `just test` + `just test-web`
- [ ] G2 `elysia` 1.4.30 / `@elysiajs/openapi` 1.4.16 / `@elysiajs/eden` 随动；跑 `just test`（Eden treaty 类型面）+ `bun typecheck`
- [ ] G3 `drizzle-orm` 0.45.4 + `drizzle-kit` 0.31.11；`bun run db:generate` 确认无 schema drift（`just check-app-schema`）
- [ ] G4 `@platejs/*` + `platejs` 53.3.x 锁步；`just test-web`（编辑器组件）
- [ ] G5 杂项 patch/minor：`@xyflow/react` / `@radix-ui/*` / `@testing-library/*` / `msw` 2.x 内 / `@types/*`
- [ ] G6 dev 工具链 `oxlint` 1.87 + `oxfmt` 0.72；新增 lint 告警同批清零（`bun run lint` 0 错 0 警）
- [ ] G7 批次门禁：`just qa` 全绿 → commit `chore(deps): batch G — patch/minor 锁步`

## Batch Y — `@ai-sdk/*` 六件套锁步（核心适配）

- [ ] Y1 六件套 `@ai-sdk/{anthropic,deepseek,google,openai,openai-compatible,provider}` 升 latest（package.json 精确 pin），`bun install` 后先看 `bun run typecheck` 错误面
- [ ] Y2 适配 cast wall：`providers.ts resolveChatModel` / `middleware.ts` / `stream.ts` / `qa/handler.ts` / `outputs/generator.ts`。V4→V5 breaking 时收敛为单一 normalize 函数，V4 类型不出 `ai/` 目录
- [ ] Y3 provider 回归：`just test`（provider mock 全套）+ `bun scripts/check-provider-deps.ts` 绿；手工 smoke `bun src/server.ts` preflight（无 key 环境验证到「模型未配置」即止，证明 import 链完整）
- [ ] Y4 `just type-aware-lint`（advisory）过一眼签名墙；`just qa` 全绿 → commit `feat(server): adapt ai-sdk provider major/minor —— cast wall 收敛`

## Batch R — 大版本（逐项评估，允许裁剪降级）

- [ ] R1 `tailwindcss` 3→4 评估 spike：迁移面（`@tailwind` 指令/content/插件）。**≤1 天工时才做**，否则记 known-issues 裁出
- [ ] R2 `@mui/icons-material` 7→9（icon props 兼容）；`just test-web`
- [ ] R3 `msw` 2→3（`apps/web/src/test-utils/` 适配）；全量 `just test-web`
- [ ] R4 `jsdom` 30 + `@types/jsdom` 30（devDep）
- [ ] R5 `gridstack` 14（layout API diff）；`just test-web` + 手工 workspace 网格 smoke
- [ ] R6 `gpt-tokenizer` 4：`countTokens` 口径回归（server tokenizer 测试 + QA 计数场景）
- [ ] R7 `@asteasolutions/zod-to-openapi` 9：`/openapi.json` 输出 snapshot 对比（`just check-app-schema` + `apps/server/tests/openapi-generation.test.ts`）
- [ ] R8 `oxlint-tsgolint` 7.x + `tailwind-scrollbar` 4（advisory/devDep，失败不阻塞）
- [ ] R9 批次门禁：每项独立 commit；`just qa` 全绿

## 收尾

- [ ] F1 `bun install` 全量收敛；`git diff bun.lock` 复核无意外降级/重复版本分叉
- [ ] F2 `bun outdated` 全仓复跑，剩余项均有「已评估/裁剪」结论（写入本文件批注或 known-issues）
- [ ] F3 `docs/known-issues.md` 按台账纪律登记裁剪项（带恢复条件）
- [ ] F4 最终 `just qa` + 推送 → `llman-sdd verify` → `llman-sdd change finalize c127-deps-refresh-major-minor`
