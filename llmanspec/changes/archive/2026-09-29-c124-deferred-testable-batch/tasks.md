# Tasks

- [x] t1 server 锁测：r250（快照差异）/r252（409 hint）/r254（ready⇒可检索）/r310（busy+stale）/r316（序列化）/r317（done 形状）。验证：新 `tests/studio/deferred-lock.test.ts` 9 用例全绿；server 套件 629 pass 无回归。
- [x] t2 [blocked-by: t1] web 锁测：r302/r303/r102/r148/r445/r446/r313。验证：`just test-web` 404 pass 全绿；r303 计分逻辑经实测无 bug（预警解除），新增 QuizRunner/MindmapViewer/LabNodeDrawer/labGraphGates/useSlidesPreviewSync 五个测试文件。
- [x] t3 [blocked-by: t1] specs：13 条场景化 + r13/r205 重锚（重锚前补 r205 SLIDES 专属 400 断言）。验证：validate specs 结构通过（步骤关键词勘误 3 处）；review unbound 72 → 59 精确命中；r13/r205 重锚到真实测试并补 r205 SLIDES 专属 400 断言。
- [x] t4 [blocked-by: t2,t3] 回归收口：`just test-bdd` + `just qa` 全绿；地图同步（finalize 后 main 提交）。
