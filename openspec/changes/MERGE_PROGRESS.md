# OpenSpec changes 合并进度

> 说明：本文件记录“proposal 合并”进度与映射。合并完成后，旧 change 会被删除，引用会被统一到 canonical change。

当前 active changes：`101`（`priority.json` 由脚本按 `openspec/changes/c*/proposal.md` 重建）。

## Wave 1（执行顺序）

- [x] 1) `c2025` ← `c2064`（concurrency budgets/backpressure）
- [x] 2) `c2020` ← `c2079`（dev diagnostics workbench/state dumps）
- [x] 3) `c2167` ← `c3002`（frontend error UX + recovery actions）
- [x] 4) `c2033` ← `c3007`（command intent routing / composition）
- [x] 5) `c2021` ← `c2158`（OpenAPI/SDK drift gates + release playbook）
- [x] 6) `c2223` ← `c2224`（tool config contract + UI）
- [x] 7) `c1042` ← `c1050`（backend feature module conventions + migration sweep）
- [x] 8) `c1002` ← `c1043`（DB drift gates + sqlite baselines）
- [x] 9) `c4062` ← `c4064`（diagnostics export pack + perf traces）
- [x] 10) `c4035` ← `c4037`（section locking & incremental regen：slides/report）
- [x] 11) `c2074` ← `c4019`（output renderer unification）
- [x] 12) `c4028` ← `c4029`/`c4058`/`c4059`（source connector plugins pack）

## Wave 2（追加合并）

- [x] 1) `c1006` ← `c1012`（prompt preset lineage/migration）
- [x] 2) `c2034` ← `c2099`/`c2177`（citations: locator v2 + review queue + sweeps）
- [x] 3) `c2019` ← `c1023`（plugin health + host smoke tests）
- [x] 4) `c2193` ← `c2200`（index refresh: diff/impact + SLO/alerting）
- [x] 5) `c2169` ← `c2184`（cache policy/visibility + stampede guards）
- [x] 6) `c2154` ← `c2186`（vector store contract/parity + ANN tuning knobs）
- [x] 7) `c2000` ← `c2005`（workspace/core domain object model + IDs + readiness）
- [x] 8) `c2168` ← `c1008`（capability matrix: profile + parser formats/fallbacks）

## Wave 3（继续合并）

- [x] 1) `c1003`（rename）← `c1004`（backup/migration/recovery + tiered archive/cold storage）
- [x] 2) `c1010`（rename）← `c1028`（capability negotiation + fallback order + route audit）
- [x] 3) `c1035`（rename）← `c1036`（startup self-test/baseline + env drift/dependency audits）
- [x] 4) `c1047` ← `c1046`（embedding upgrades + vector index audits/repair）
- [x] 5) `c2019` ← `c2081`（plugin health/smoke tests + registry compat diagnostics）
- [x] 6) `c2021` ← `c2083`（SDK drift gates/playbook + OpenAPI contract drift watch）
- [x] 7) `c2034` ← `c2047`/`c2054`/`c1044`（citations: span/anchoring + backfill/repair + drift/remap jobs）
- [x] 8) `c2104`（rename）← `c2120`（hypothesis/verdict evolution + conflict matrix/resolution lanes）
- [x] 9) `c2116`（rename）← `c2133`（state/schema ownership + change checklists + repair playbooks）
- [x] 10) `c2173`（rename）← `c2180`（retrieval snapshots + proof packs）
- [x] 11) `c2175`（rename）← `c2176`（hybrid retrieval fusion/fallbacks + rerank explainability）
- [x] 12) `c2193`（rename）← `c2197`/`c2198`（staleness consistency/planning + refresh diff/SLO）
- [x] 13) `c2239`（rename）← `c2245`（perf fixtures/benchmarks + CI diff/baseline management）

## Wave 4（追加合并）

- [x] 1) `c1002` ← `c1041`（DB constraints/indexes/query hygiene → drift gates + sqlite baselines）
- [x] 2) `c2082`（rename）← `c2084`（real-workspace eval capture/replay + fixture sanitization/minimization）

## Wave 5（追加合并）

- [x] 1) `c1035` ← `c1040`（dependency upgrade risk notes/migration hints → baseline/self-test/drift audits）
- [x] 2) `c2155`（rename）← `c2156`（frontend SWR cache invalidation + SSE envelope/stream client）
- [x] 3) `c2163` ← `c2159`（app lifespan/shutdown safety + upstream HTTP client pooling/timeout policy）
- [x] 4) `c2193` ← `c2205`/`c2206`（refresh fences/read-after-write + staleness propagation/effective freshness）

## Wave 6（追加合并）

- [x] 1) `c2034` ← `c2178`（citation span mapping/highlights → CitationV2 review/repair bundle）
- [x] 2) `c2193` ← `c2196`（indexing idempotency/write barrier → staleness/refresh bundle）

## Wave 7（追加合并）

- [x] 1) `c1006`（rename）← `c2219`（generation presets + constraints）
- [x] 2) `c1038`（rename）← `c2150`（local store integrity checks + healing suggestions）
- [x] 3) `c2138`（rename）← `c2146`（argument pressure tests + countercase drafts）
- [x] 4) `c2034` ← `c2055`/`c2128`/`c2179`（source viewer highlights/inline notes + hover proof/sidecars + citation context batch/prefetch）
- [x] 5) `c1000` ← `c1022`（config profile diff + drift explainer）
- [x] 6) `c1007` ← `c1018`（doc/spec/code link index + coverage map）

## Wave 8（追加合并）

- [x] 1) `c2153` ← `c2012`（optional services readiness + degraded mode contract）
- [x] 2) `c2003` ← `c2017`（Eval Center scorecards + datasets/minimum model）
- [x] 3) `c2024` ← `c2162`（web vitals budgets + performance marks + perf gates）
- [x] 4) `c4055` ← `c4016`（connectors: preflight + sync diagnostics + user-facing summaries）
- [x] 5) `c4035` ← `c4020`（slides incremental regen/locking → generalized output section locking）
- [x] 6) `c2019` ← `c4063`（plugin health/compat matrix ← frontend bundle smoke tests）
- [x] 7) `c2227` ← `c4008`（Command Palette: action surface + shortcuts + automation）
- [x] 8) `c2072` ← `c2201`/`c2203`（index refresh DAG/stages + lexical domain contract → staleness/incremental refresh）
- [x] 9) `c2155` ← `c2172`/`c2234`（frontend SSE: multiplex/resource guards + coalescing/throttling）
- [x] 10) `c2006` ← `c2241`（SSE envelope contract + server-side buffering/backpressure/compression）
- [x] 11) `c2154` ← `c2187`（vector store: benchmarks + profile parity reports）
- [x] 12) `c2181` ← `c2189`（retrieval regression suite ← SLO metrics + drift gates）

## Wave 9（追加合并）

- [x] 1) `c4055` ← `c4057`/`c4060`（connectors: framework + preflight/diagnostics + diagnostics UI/recovery hints）
- [x] 2) `c2024` ← `c2239`/`c2242`（web perf budgets/gates ← perf fixtures+baselines + dev profiler overlay）
- [x] 3) `c4050` ← `c2010`（long-running watchers/monitors ← recurring monitoring + delta briefings）
- [x] 4) `c2072` ← `c2190`/`c2192`/`c2194`/`c2195`/`c2199`/`c2204`/`c2207`/`c2208`/`c2209`（index refresh control plane merge）
- [x] 5) `c4055` ← `c1051`（connectors: sync_check diff + snapshot semantics）

## Wave 10（追加合并）

- [x] 1) `c2040` ← `c3005`（workspace home/operating cockpit ← state projection + home entry）
- [x] 2) `c3015` ← `c2042`/`c4023`（daily review ← work queues/review buckets + activity heatmap/routine loops）
- [x] 3) `c4025` ← `c2075`（output draft lifecycle ← output diff compare + version review）
- [x] 4) `c2059` ← `c2174`（retrieval lens/intents ← seed_catalog + query rewrite explainability）
- [x] 5) `c2065` ← `c2067`（model capability profiles ← preflight output schema compatibility checks）

## Wave 11（追加合并）

- [x] 1) `c1053` ← `c2246`（backend serialize hotspot metrics + representation cache）
- [x] 2) `c1049` ← `c1048`（rolling index snapshots/time-travel debug → write atomicity + tombstones + compaction）

## Wave 12（追加合并）

- [x] 1) `c1000` ← `c1029`（config rationale journal + safe defaults audit）
- [x] 2) `c1001` ← `c1019`/`c1020`/`c1021`（storage maintenance: compaction/vacuum + footprint + asset cleanup + stale bundle detection）
- [x] 3) `c1003` ← `c1024`/`c1031`（migration readiness/rollback checkpoints + recovery drills/backup verification）
- [x] 4) `c1017` ← `c1026`（chaos fixtures for async pipelines + recovery checks）

## Wave 13（追加合并）

- [x] 1) `c1035` ← `c1030`/`c1038`（workspace health score + repair wizards ← startup self-test/drift audits）
- [x] 2) `c2082` ← `c1032`/`c1039`（eval capture/replay ← data lineage/refresh cadence + diff explanations/exceptions）

## Wave 14（追加合并）

- [x] 1) `c2008` ← `c1011`（task cancellation/resumption/orphan cleanup → run lifecycle contract）
- [x] 2) `c2151` ← `c1013`（worker heartbeat + stuck job detection → task runtime durability/restart reconciliation）

## Wave 15（追加合并）

- [x] 1) `c2171` ← `c2228`（model endpoint picker/override + health explainer UI → endpoint health + failover routing）

## Wave 16（追加合并）

- [x] 1) `c4040` ← `c4044`（run dry run/simulation → stage checkpoints + approval gates）

## Wave 17（追加合并）

- [x] 1) `c4049` ← `c4052`（quarterly knowledge atlas/domain shifts → monthly domain briefs + knowledge landmarks）

## Wave 18（追加合并）

- [x] 1) `c4042` ← `c4036`/`c4045`（output composition templates/layout guards + personal style examples → section style profiles/tone guards）

## Wave 19（追加合并）

- [x] 1) `c2030` ← `c2044`（ingestion retry/recovery + partial success → ingestion contracts/dedup/chunking）

## Wave 20（追加合并）

- [x] 1) `c1047` ← `c1045`（vector entry metadata v2 + drift detection → embedding upgrades + safe migrations）

## Wave 21（追加合并）

- [x] 1) `c1001` ← `c2085`（cache epoch inspection + invalidation preview → storage/cache maintenance tooling）

## Wave 22（追加合并）

- [x] 1) `c2115` ← `c2129`/`c2147`（reading level/density rewrites + polish/finish checks → longform rewrite passes/structural refinement）

## Wave 23（追加合并）

- [x] 1) `c1042` ← `c1052`/`c1054`（backend typecheck/static gates + startup import audit/lazy loading → feature module conventions/migration gates）

## Wave 24（继续合并）

- [x] 1) `c2095` ← `c2118`（source bundle comparisons + readiness rankings → refresh diff/brief）
- [x] 2) `c2053` ← `c2057`（retrieval result clustering/duplicate collapse → retrieval query trace + replay）
- [x] 3) `c3008` ← `c3010`（workspace focus mode + distraction pruning → layout presets + view memory）
- [x] 4) `c2040` ← `c3019`（collection home/navigation → workspace state projection + home/cockpit）
- [x] 5) `c2063` ← `c2061`（failure replay + step re-entry → task feed compaction + event timeline）
- [x] 6) `c4010` ← `c4014`（secrets vault + credential rotation → structured data connectors + SQL workflows）
- [x] 7) `c1015` ← `c2077`（notebook fragments/snippets → block history + undo checkpoints）
- [x] 8) `c2058` ← `c2095`（refresh diff/brief + comparisons/rankings → source pack assembly + watchlists）

## Wave 25（继续合并）

- [x] 1) `c3008` ← `c3006`（cross-panel selection + deep link contract → workspace UI state bundle）

## Wave 26（继续合并）

- [x] 1) `c2072` ← `c2193`（staleness consistency/budgets + query planning → index refresh control plane）

## Wave 27（继续合并）

- [x] 1) `c2152` ← `c2213`（correlation id：browser → worker 端到端贯穿）
- [x] 2) `c2160` ← `c2211`（error contract + error_code registry + enforcement）
- [x] 3) `c2215` ← `c2216`（analysis artifact + graph deeplinks/navigation）

## Wave 28（继续合并）

- [x] 1) `c4026` ← `c4030`（OCR fallback + provenance/quality signals）
- [x] 2) `c2126` ← `c2145`（decision memo + evidence appendix autobuild + traceable footnotes）
- [x] 3) `c2223` ← `c2225`（tool config persistence/UI + secrets + redaction）
- [x] 4) `c2050` ← `c2052`（collections v1 + collection-scoped retrieval/generation）
- [x] 5) `c2155` ← `c2212`（SWR key registry/SSE client + data fetching standardization/adoption）
- [x] 6) `c2018` ← `c2066`（repro packs + run input snapshots）

## Wave 29（继续合并）

- [x] 1) `c2045` ← `c2046`（source dedup pipeline + review UI/actions）
- [x] 2) `c2056` ← `c2109`（language detection/hints + bilingual evidence pairs/comparison）

## Wave 30（继续合并）

- [x] 1) `c2053` ← `c2016`（retrieval query trace + snapshot + debug view）
- [x] 2) `c2218` ← `c2220`/`c2221`/`c2222`（typed generation + transformations/refine/gates/review）

## Wave 31（继续合并）

- [x] 1) `c2038` ← `c2111`/`c2121`（coverage holes + targeted fetch/recapture）
- [x] 2) `c2037` ← `c2122`（goal briefs + run goal contract/success checks）

## Wave 32（继续合并）

- [x] 1) `c2078` ← `c2110`（timeline evidence bands + event reconstruction/ordering）

## Wave 33（继续合并）

- [x] 1) `c4018` ← `c4033`（web capture cleaning profiles + reader normalization）
- [x] 2) `c4025` ← `c4035`（output section locking + incremental regeneration）

## Wave 34（继续合并）

- [x] 1) `c2076` ← `c2100`（briefing reading mode + side-by-side evidence）

## Wave 35（继续合并）

- [x] 1) `c2020` ← `c4062`（dev diagnostics workbench/state dumps + diagnostics export pack）

## Wave 36（继续合并）

- [x] 1) `c2092` ← `c2138`（claim strength/evidence weight + counterevidence quotas + pressure tests）
- [x] 2) `c4047` ← `c2139`（reading packets/offline review bundles + evidence packets）
- [x] 3) `c2002` ← `c2119`（evidence gap/claim checking + weak link detection）

## Wave 37（继续合并）

- [x] 1) `c4005` ← `c4009`（artifact releases/channels + Git/PR publishing）

## Wave 38（继续合并）

- [x] 1) `c2060` ← `c2217`（contradiction highlights/resolution notes + triage workflow）

## Wave 39（继续合并）

- [x] 1) `c2020` ← `c2235`（run timings breakdown + perf timeline view）
- [x] 2) `c2020` ← `c2244`（runtime memory budget + leak detectors）

## Wave 40（继续合并）

- [x] 1) `c2153`（rename）← `c2168`（capability matrix（profile + parser）+ optional services readiness 收敛）

## Wave 41（继续合并）

- [x] 1) `c2173`（rename）← `c2181`（retrieval snapshot/proof pack + regression gates 收敛）

## Wave 42（继续合并：证据 / 生成 / 上下文 / 实体 / 决策账本）

- [x] 1) `c2002` ← `c2060` / `c2094` / `c2104`（证据完整性：缺口·矛盾·共识·假设）
- [x] 2) `c2097` ← `c2113`（证据优先生成·刹车·不确定性带）
- [x] 3) `c2062` ← `c2070` / `c2123`（上下文窗口：预算解释·档位·多轮 staging）
- [x] 4) `c2032` ← `c2103`（规范实体·术语·个人 glossary/settling）
- [x] 5) `c2014` ← `c2022`（决策账本·审阅与使用学习闭环）
- [x] 6) 删除上述已吸收 change 目录；`priority.json` / `PRIORITY.md` 已 `rebuild_priority_index.py` 重建

## Wave 43（清理：已在他处「合并说明」收口的薄壳目录）

- [x] 1) 删除仍残留的已吸收 change（仅 `proposal.md` + `.openspec.yaml`），并重建 `priority.json` / `PRIORITY.md`
- [x] 2) 映射：`c2096`/`c2142` → `c2069`；`c2247` → `c2236`；`c2125` → `c2144`；`c2223` → `c2167`；`c2043` → `c2089`；`c2182` → `c2154`；`c2087`/`c2136` → `c2135`

## Wave 44（proposal 合并：键盘·工作流模板·数据表达栈·可视化闭环·采集）

- [x] 1) `c3013` ← `c3017`（键盘优先导航与多选 + 批处理动作）
- [x] 2) `c4000` ← `c4004`（recipe 起步路径 + workspace 模板与 operating playbook）
- [x] 3) `c4010` ← `c4011`/`c4012`（结构化连接/SQL + 表格变换 + 图表看板）
- [x] 4) `c4038` ← `c4039`/`c4043`（表图联动钻取 + 图表说明/摘要卡 + 来源绑定与刷新传播）
- [x] 5) `c4022` ← `c4024`（收件箱分拣 + 转 notebook 与结构建议）
- [x] 6) 删除上述已吸收 change 目录；更新 `c2029`/`c2036` 等对旧编号的依赖表述；`priority.json` / `PRIORITY.md` 已 `rebuild_priority_index.py` 重建

## Wave 45（知识地标 / run 反思 / 检索治理 / 工作区数据平面 / 观测+运维）

- [x] 1) `c4046` ← `c4049`/`c4051`（fact sheet + 月度·季度地标 + 主题退休/冷重返）
- [x] 2) `c4041` ← `c4048`（run 复盘 + 决策日志/why-it-changed）
- [x] 3) `c4079` ← `c4080`（trace/排序/回放 + cache/QoS/warmup/冷路径）；`c4079` ← `c2154`（向量契约/parity/bench/ANN/`index_generation_id`/原子读快照）；`specs/` 已迁入 `c4079`；已删除 `c2154` 目录
- [x] 4) `c4072` ← `c4073`（bootstrap/hydration + client cache/SSE/取消/snapshot）；`specs/` 已迁入 `c4072`
- [x] 5) `c4063` ← `c4068`（observability/diagnostics + startup health/maintenance/repair）；`specs/` 已迁入 `c4063`
- [x] 6) 删除上述已吸收 change 目录；`priority.json` / `PRIORITY.md` 由 `rebuild_priority_index.py` 重建

## 映射

- `c2064` → `c2025`
- `c2079` → `c2020`
- `c3002` → `c2167`
- `c3007` → `c2033`
- `c2158` → `c2021`
- `c2224` → `c2223`
- `c1050` → `c1042`
- `c1043` → `c1002`
- `c4064` → `c4062`
- `c4037` → `c4035`
- `c4019` → `c2074`
- `c4029` → `c4028`
- `c4058` → `c4028`
- `c4059` → `c4028`
- `c1012` → `c1006`
- `c2099` → `c2034`
- `c2177` → `c2034`
- `c1023` → `c2019`
- `c2200` → `c2072`
- `c2184` → `c2169`
- `c2186` → `c2154`
- `c2005` → `c2000`
- `c1008` → `c2168`
- `c1004` → `c1003`
- `c1028` → `c1010`
- `c1036` → `c1035`
- `c1046` → `c1047`
- `c1044` → `c2034`
- `c2047` → `c2034`
- `c2054` → `c2034`
- `c2081` → `c2019`
- `c2083` → `c2021`
- `c2120` → `c2104`
- `c2133` → `c2116`
- `c2176` → `c2175`
- `c2180` → `c2173`
- `c2197` → `c2072`
- `c2198` → `c2072`
- `c2245` → `c2239`
- `c1041` → `c1002`
- `c2084` → `c2082`
- `c1040` → `c1035`
- `c2156` → `c2155`
- `c2159` → `c2163`
- `c2205` → `c2072`
- `c2206` → `c2072`
- `c2178` → `c2034`
- `c2196` → `c2072`
- `c2219` → `c1006`
- `c2150` → `c1035`
- `c2146` → `c2138`
- `c2055` → `c2034`
- `c2128` → `c2034`
- `c2179` → `c2034`
- `c1022` → `c1000`
- `c1018` → `c1007`
- `c2012` → `c2153`
- `c2168` → `c2153`
- `c2181` → `c2173`
- `c2017` → `c2003`
- `c2162` → `c2024`
- `c4016` → `c4055`
- `c4020` → `c4035`
- `c4063` → `c2019`
- `c4008` → `c2227`
- `c2201` → `c2072`
- `c2203` → `c2072`
- `c2172` → `c2155`
- `c2234` → `c2155`
- `c2241` → `c2006`
- `c2187` → `c2154`
- `c2189` → `c2181`
- `c4057` → `c4055`
- `c4060` → `c4055`
- `c2239` → `c2024`
- `c2242` → `c2024`
- `c2010` → `c4050`
- `c2190` → `c2072`
- `c2192` → `c2072`
- `c2194` → `c2072`
- `c2195` → `c2072`
- `c2199` → `c2072`
- `c2204` → `c2072`
- `c2207` → `c2072`
- `c2208` → `c2072`
- `c2209` → `c2072`
- `c1051` → `c4055`
- `c3005` → `c2040`
- `c2042` → `c3015`
- `c4023` → `c3015`
- `c2075` → `c4025`
- `c2174` → `c2059`
- `c2067` → `c2065`
- `c2246` → `c1053`
- `c1048` → `c1049`
- `c1029` → `c1000`
- `c1019` → `c1001`
- `c1020` → `c1001`
- `c1021` → `c1001`
- `c1024` → `c1003`
- `c1031` → `c1003`
- `c1026` → `c1017`
- `c1030` → `c1035`
- `c1038` → `c1035`
- `c1032` → `c2082`
- `c1039` → `c2082`
- `c1011` → `c2008`
- `c1013` → `c2151`
- `c2228` → `c2171`
- `c4044` → `c4040`
- `c4052` → `c4046`（经原 `c4049` 能力并入 `c4046`）
- `c4049` → `c4046`
- `c4051` → `c4046`
- `c4048` → `c4041`
- `c4080` → `c4079`
- `c2154` → `c4079`（向量契约/parity/bench/ANN/代际读快照；原 `c2154` change 目录已删除）
- `c4073` → `c4072`
- `c4068` → `c4063`
- `c4036` → `c4042`
- `c4045` → `c4042`
- `c2044` → `c2030`
- `c1045` → `c1047`
- `c2085` → `c1001`
- `c2129` → `c2115`
- `c2147` → `c2115`
- `c1052` → `c1042`
- `c1054` → `c1042`
- `c2057` → `c2053`
- `c2061` → `c2063`
- `c2077` → `c1015`
- `c2095` → `c2058`
- `c2118` → `c2058`
- `c3010` → `c3008`
- `c3019` → `c2040`
- `c4014` → `c4010`
- `c3006` → `c3008`
- `c2193` → `c2072`
- `c2213` → `c2152`
- `c2211` → `c2160`
- `c2216` → `c2215`
- `c4030` → `c4026`
- `c2145` → `c2126`
- `c2225` → `c2223`
- `c2052` → `c2050`
- `c2212` → `c2155`
- `c2066` → `c2018`
- `c2046` → `c2045`
- `c2109` → `c2056`
- `c2016` → `c2053`
- `c2220` → `c2218`
- `c2221` → `c2218`
- `c2222` → `c2218`
- `c2111` → `c2038`
- `c2121` → `c2038`
- `c2122` → `c2037`
- `c2110` → `c2078`
- `c4033` → `c4018`
- `c4035` → `c4025`
- `c2100` → `c2076`
- `c4062` → `c2020`
- `c2138` → `c2092`
- `c2139` → `c4047`
- `c2119` → `c2002`
- `c4009` → `c4005`
- `c2217` → `c2060`
- `c2060` → `c2002`
- `c2094` → `c2002`
- `c2104` → `c2002`
- `c2113` → `c2097`
- `c2070` → `c2062`
- `c2123` → `c2062`
- `c2103` → `c2032`
- `c2022` → `c2014`
- `c2096` → `c2069`
- `c2142` → `c2069`
- `c2247` → `c2236`
- `c2125` → `c2144`
- `c2223` → `c2167`
- `c2043` → `c2089`
- `c2182` → `c2154`
- `c2087` → `c2135`
- `c2136` → `c2135`
- `c2235` → `c2020`
- `c2244` → `c2020`
- `c3017` → `c3013`
- `c4004` → `c4000`
- `c4011` → `c4010`
- `c4012` → `c4010`
- `c4039` → `c4038`
- `c4043` → `c4038`
- `c4024` → `c4022`
