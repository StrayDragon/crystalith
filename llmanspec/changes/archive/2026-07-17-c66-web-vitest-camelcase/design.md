# Design: c66-web-vitest-camelcase

## Approach

1. **Matcher registration** — Diagnose why `@testing-library/jest-dom/vitest` does not
   extend Vitest `expect` (`Invalid Chai property: toBeInTheDocument`). Prefer fixing
   setup (import order / explicit `expect.extend`) over rewriting every assertion to
   non-jest-dom matchers.
2. **Fixtures** — Sweep MSW `HttpResponse.json(...)` bodies and `expect(...).toEqual`
   payloads to camelCase keys matching `@crystalith/shared` / Eden wire after c65.
3. **stream unit test** — Convert `stream.test.ts` from `bun:test` to Vitest; assert
   `messageId` (not `message_id`) on done payloads.
4. **CI script** — If `test:ci` still dies in `test_mock_report.mjs` (`ts.ScriptKind`),
   fix or gate that script so the documented web test command is runnable.

## Out of scope

Production routers, shared Zod field names, DB JSON migration.
