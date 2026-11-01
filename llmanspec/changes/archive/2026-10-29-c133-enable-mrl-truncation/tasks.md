# Tasks — MRL 截断（eval 基准先行）

> 完成判据里的基线/对比数字一律在本 change 分支上测得（相对 merge-base）。
> T1 不达标（256 维 recall@10 相对衰减 > 5%）→ 停止后续任务并关闭本 change，
> 在 proposal 顶部记录 no-go 结论与数据。

## T1 eval 基准框架与基线

- [x] T1.1 建 `apps/server/tests/rag/mrl-eval/`：固定语料 fixture（数十文档，
      含 CJK）+ 已知查询对（≥20 条，标注期望命中文档）
- [x] T1.2 实现 eval runner（bun test 可跑，非 CI 必跑项）：embed 语料 →
      sqlite-vec KNN → recall@k / nDCG@10，报告落盘 JSON+MD
- [x] T1.3 跑 768 维基线并落盘报告；跑 512/256 截断（客户端切片 + L2 归一化，
      eval 内模拟路径②）三组对比，结论写回本文件下方
- 验证：`cd apps/server && bun test tests/rag/mrl-eval/`（runner 自身用例绿）
- seam：eval runner 以 embedding engine 公共接口 + searchVectors 为边界（不 mock KNN）

## T2 截断实现（双路径）

- [x] T2.1 config schema：新增 embedding 截断维度开关（默认 null=关）；合法域校验
      （∈ 所选模型 mrlDims），非法值启动拒绝 `[blocked-by: T1.3]`
- [x] T2.2 engine 路径②：截断 + 内联 L2 再归一化 + 模长校验 warn `[blocked-by: T2.1]`
- [x] T2.3 engine 路径①：embed 请求带 `dimensions` 探测与固定；降级② `[blocked-by: T2.2]`
- [x] T2.4 行为锁测：截断后向量模长 ≈1、维度 = 目标、开关关闭时零变化
      （`// covers: r493/r494`） `[blocked-by: T2.3]`
- 验证：`just test` 全绿 + `just qa`

## T3 规格与收口

- [x] T3.1 spec 场景与实现对齐复核（`llman-sdd verify`）+ BDD/integration 不回归
      `[blocked-by: T2.4]`
- 验证：`bunx llman-sdd validate c133-enable-mrl-truncation --strict`；
  `just qa`；`just test-bdd`

---

## T1.3 对比结论（2026-10-28，真实网关 embeddinggemma-2 @ tufa:50233 录制）

- 768 基线：recall@10 = 1.0000，nDCG@10 = 0.8324
- 512：recall@10 = 0.9583（Δ -4.17%，单查询预期文档滑出 top-10）
- 256：recall@10 = 1.0000（Δ 0.00%），nDCG@10 = 0.8385 → **go**
- 报告：`tests/rag/mrl-eval/reports/mrl-eval-report.{json,md}`；向量 fixture
  `vectors.fixture.json`（768 维，30 docs + 24 queries）已入库可复现
- 注意：语料为 30 篇主题互斥短文档，任务相对容易（基线触顶 1.0）；真实
  库规模下衰减可能更明显——上线默认关闭（r493），启用时建议用户以本
  runner 换自有语料复测
