# Change: c66-web-vitest-camelcase

## Why

c65 moved production HTTP/SSE JSON to camelCase, but `apps/web` Vitest still fails
(~44 tests / 15 files). Failures block the web quality gate deferred from c65 task 4.4.
Root causes are test infrastructure and fixtures, not production wire regressions:

1. `@testing-library/jest-dom` matchers (e.g. `toBeInTheDocument`) not effectively
   registered → `Invalid Chai property`
2. MSW handlers / mock payloads / assertions still use snake_case or v1 URL shapes
3. `stream.test.ts` is authored for `bun:test` with snake `message_id`, but is collected
   by Vitest and must assert camelCase `messageId`

## What Changes

- Repair Vitest setup so jest-dom matchers work under the project's Vitest config
- Update web test fixtures, MSW handlers, and expectations to camelCase wire
- Align `stream.test.ts` with Vitest + c65 SSE payload shape
- Restore green `cd apps/web && bunx vitest run` (and `test:ci` if the mock-report
  script is in scope and broken)

## Non-goals

- No further production API field renames (c65 closed)
- No DB migration work
- No enabling skipped BDD feature dirs

## Impact

- Specs: `frontend-eden-migration` (test fixtures MUST match camelCase wire)
- Code: `apps/web/**/*.test.*`, `apps/web/src/setupTests.ts`, optionally
  `apps/web/scripts/test_mock_report.mjs`
- Compatibility: tests only; production unchanged

## Capabilities

- frontend-eden-migration
