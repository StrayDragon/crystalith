# Tasks

- [x] t1 G 组锁测：新 `tests/config-governance.test.ts`（r30 优先级链 / r32 三段流水线失败即抛 / r34 data_root 派生与覆盖 / r37 确定性 / r38 三级解析与 headless）+ registry.test 补 r16 kind 覆盖面断言。验证：新 `tests/config-governance.test.ts` 14 用例 + registry.test r16 断言全绿；server 套件 644 pass 无回归（resolveMigrationsFolder 转导出）。
- [x] t2 [blocked-by: t1] 移除：C 组 5 条（r176-r179/r182）+ r345（含 `app.auth` 死配置段与 i18n key 清理、app.schema.gen.json 再生成）。验证：validate specs 通过；review unbound 59 → 47 精确命中；app.auth 段/CRYSTALITH_API_KEY 死字段/i18n key/.env.example 行一并清理，schema 与 env example 门禁产物再生。
- [x] t3 [blocked-by: t2] 回归收口：`just test-bdd` + `just qa` 全绿；地图与台账同步（finalize 后 main 提交）。
