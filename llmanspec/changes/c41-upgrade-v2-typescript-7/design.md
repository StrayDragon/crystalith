# c41-upgrade-v2-typescript-7 — Design

## Decision: bump typescript to ^7

typescript@7.0.2 ships Go-native `tsc` built-in — no separate `@typescript/native-preview` package needed.
Just upgrading `typescript` devDependency to `^7` in all three workspaces.

## Approach: minimal bump + fix errors

1. Change `"typescript": "^5"` / `"^5.9.2"` to `"typescript": "^7"` in three package.json files
2. `bun install`
3. Fix any TS 7.0-incompatible type errors (expected few, mostly Elysia/Drizzle/rivu-* edge cases)
4. Unify `moduleResolution` to lowercase `"bundler"` across all tsconfig files
5. Verify full typecheck + test suite

## Rollback

`git checkout` the three package.json files back to `^5`.
No schema migrations, no data changes — purely a devDependency version bump.
