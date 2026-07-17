## 0. Guardrails

- [x] 0.1 确认不改 production wire；只修 `apps/web` 测试/setup
- [x] 0.2 `llman sdd show c66-web-vitest-camelcase`

## 1. Vitest / jest-dom setup

- [x] 1.1 修复 `toBeInTheDocument` 等 matcher 注册（`setupTests.ts` / Vitest config）
- [x] 1.2 抽检 `GenericOutputRenderer.test.tsx` 不再报 `Invalid Chai property`

验证：`cd apps/web && TZ=UTC bunx vitest run src/features/workspace/domains/outputs/GenericOutputRenderer.test.tsx`

## 2. CamelCase fixtures & MSW

- [x] 2.1 更新失败测试中的 mock body / query / 断言为 camelCase
- [x] 2.2 修复 `useChat` / `useSources` / `useResearch` / `useOutputQueue` / `useRefine` 等 hook 测试
- [x] 2.3 修复 panel/dialog/onboarding 等 UI 测试依赖的数据形状

验证：按文件跑红测直至相关 suite 绿

## 3. stream.test.ts

- [x] 3.1 改为 Vitest；done payload 断言 `messageId`
- [x] 3.2 确保 Vitest 可收集并执行该文件

验证：`cd apps/web && TZ=UTC bunx vitest run src/api/stream.test.ts`

## 4. Gate

- [x] 4.1 `cd apps/web && TZ=UTC bunx vitest run` 全绿
- [x] 4.2 若项目门禁用 `bun run test:ci`，修复 mock-report 脚本阻塞或等价使 CI 可跑
- [x] 4.3 `bun typecheck`；`llman sdd validate c66-web-vitest-camelcase --strict --no-interactive`
