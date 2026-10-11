---
depends_on: []
needs_specs_change: false
---

## Why

依赖全景老化 + 版本漂移风险在 c127 前的 fallow 清理中已实证：

1. **`bun add` 重解析漂移已咬人**：清理期间 `bun add` 将 `@ai-sdk/*` 从 4.0.9 重解析至 4.0.78，`LanguageModelV4` 类型墙炸出 30 个 TS 错，被迫钉回。证明「半升级态」（package.json 旧 pin + lockfile 新解析）是现实风险，需一次性收敛。
2. **安全/缺陷修复窗口**：`ai` 7.0.17→7.0.137 隔 120 个 patch（核心运行时）；`zod` 4.4.3→4.6.5、`drizzle`/`elysia` patch 线均滞后。
3. **门禁已就位**：`just qa` 现含 `audit-fallow`（变更面 new-only gate）与 `audit-fallow-arch`（循环依赖全量 gate），加既有 typecheck/lint/单测/e2e，升级回归有完整兜底，适合单分支大批量操作。

**单 change 聚焦（用户决策）**：不按包拆多个 PR，全部依赖适配收进本 change 一个分支——按批次 commit、逐批过 `just qa`，最后整体收口。依赖间强耦合（`@ai-sdk/*` 六件套互 pin provider、`zod` 贯穿三 workspace、Elysia↔Zod 协同），拆开反而制造大量中间半升级态。

## What Changes

同一 change 内**三批次 commit**，每批独立过 `just qa`：

### Batch G — 绿批：patch/minor 锁步（无 breaking）
- `ai` 7.0.17 → 7.0.x latest
- `zod` 4.4.3 → 4.6.x（server + web + shared dev/peer 锁步）
- `elysia` → 1.4.30、`@elysiajs/openapi` → 1.4.16（eden 随动）
- `drizzle-orm` → 0.45.4、`drizzle-kit` → 0.31.11
- `@platejs/*` + `platejs` 53.2 → 53.3.x 同锁步
- `@xyflow/react` / `@radix-ui/*` / `@testing-library/*` / `msw`(2.x 内) 等 patch/minor
- dev 工具链：`oxlint` 1.73→1.87、`oxfmt` 0.58→0.72（lint 增量告警同批清零）
- `@types/*` 例行

### Batch Y — 黄批：`@ai-sdk/*` 六件套锁步升级（核心适配）
- `@ai-sdk/{anthropic,deepseek,google,openai,openai-compatible,provider}` latest 锁步
- **回归焦点（cast wall）**：
  - `apps/server/src/ai/providers.ts` `resolveChatModel` — `LanguageModelV4` 三分支 cast（callable / `.chat()` / `.languageModel()`）
  - `apps/server/src/ai/middleware.ts`（5 处 LanguageModel 签名）
  - `apps/server/src/ai/stream.ts`、`features/qa/handler.ts`、`features/outputs/generator.ts`（各 2 处消费）
- 若上游 V4→V5 breaking：cast wall 收敛为单一 normalize 函数，V4 类型不泄漏出 `ai/` 目录
- 行为不变：`KNOWN_PROVIDERS` 表驱动白名单、动态 `import(sdk)` 机制、`check-provider-deps` 门禁（源码表↔package.json 漂移）必须绿
- 验证：`just type-aware-lint` + provider mock 测试 + `just qa`

### Batch R — 红批：大版本（逐项评估，可裁剪）
每项独立 commit + 独立过 qa；**遇阻降级为 follow-up change，不阻塞收口**：
- `tailwindcss` 3.4→4：web 全样式迁移——最大单项，超 1 天工时则砍出本 change
- `@mui/icons-material` 7→9、`msw` 2→3（test-utils）、`jsdom` 26→30
- `gridstack` 12→14、`gpt-tokenizer` 3→4（`countTokens` 口径回归）
- `@asteasolutions/zod-to-openapi` 8→9（`/openapi.json` snapshot 对比）
- `oxlint-tsgolint` 0.24→7.x（advisory 底座）、`tailwind-scrollbar` 3→4

### 收尾
- `bun.lock` 全量收敛，无「pin 与 lock 解析分叉」半升级态
- `docs/known-issues.md` 升级遗留条目按台账纪律处理
- fallow 双门禁 + qa 全绿后 finalize

## Non-Goals

- 不改业务行为/合约（Zod schema、Eden 路由、ResearchRun 零变更；类型适配仅限签名墙）
- 不引入新依赖
- Tauri/c13 分发线不动
- boundary zones 配置另立 change——本 change 只消费既有门禁
