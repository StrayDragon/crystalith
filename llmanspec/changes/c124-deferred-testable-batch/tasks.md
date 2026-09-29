# Tasks

- [ ] t1 server 锁测：r250（快照差异）/r252（409 hint）/r254（ready⇒可检索）/r310（busy+stale）/r316（序列化）/r317（done 形状）。验证：新测试全绿 + server 套件无回归。
- [ ] t2 [blocked-by: t1] web 锁测：r302/r303/r102/r148/r445/r446/r313。验证：`just test-web` 全绿；r303 若爆计分 bug 当场修复。
- [ ] t3 [blocked-by: t1] specs：13 条场景化 + r13/r205 重锚（重锚前补 r205 SLIDES 专属 400 断言）。验证：validate specs 通过；review unbound 72 → 59。
- [ ] t4 [blocked-by: t2,t3] 回归收口：`just test-bdd` + `just qa` 全绿；地图同步（finalize 后 main 提交）。
