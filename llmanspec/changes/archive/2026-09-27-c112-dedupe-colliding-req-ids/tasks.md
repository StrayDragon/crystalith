# Tasks — c112-dedupe-colliding-req-ids

> 计数类判据在 change 绑定分支上相对 merge-base 测量。

## t1 — 句柄重排

- [x] t1.1 按 design.md 映射表脚本化重排 54 处 `@req`（首现保留，后续 → r420-r473）。
- [x] t1.2 碰撞扫描清零：本 change 自带 check 脚本对 `llmanspec/specs/**` 报 0 碰撞；`llman-sdd spec next-req-id` 顺延为 r474。

## t2 — 本地防回归自检

- [x] t2.1 新增 `scripts/check-req-id-collisions.ts` 与 `just check-req-ids` 配方（不进 `just qa`）。

## t3 — 门禁

- [x] t3.1 `llman-sdd validate --specs --strict` 35/35 全绿；review `pending` 总数不变（448）。
- [x] t3.2 `just qa` 全绿。
