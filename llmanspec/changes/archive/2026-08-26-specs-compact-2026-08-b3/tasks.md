# Tasks — specs-compact-2026-08-b3

## T0 基线

- [x] 盘点：35 capability / 950 场景 / 542 双写（`llman sdd list --specs` + grep 计数）
- [x] 决策：全量压缩；@executable 标签先行（runner 闭环另立 change）；r268 改 spec 对齐实现
- [x] Branch binding：`sdd/specs-compact-2026-08-b3`

## T1 执行批次（按文件分派，规则见 design.md D1–D4）—— 已完成 2026-08-26

| 批  | 文件                                                                                                                                                                                                                                                                                               | 基线→目标                                                         | 特殊处置                                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| E1  | deep-research-ui                                                                                                                                                                                                                                                                                   | 140→~82                                                           | 孤立簇 r417/r439、r408/r432、r419/r441/r451；G11 dr-ui 侧                                  |
| E2  | deep-research-runtime                                                                                                                                                                                                                                                                              | 119→~62                                                           | G11 canonical（r305 保持）；保留 r316 三实例等高价值分解                                   |
| E3  | workspace-api-contract                                                                                                                                                                                                                                                                             | 94→~44                                                            | G2/G13/G3 侧、r114/r218、r69/r73；executable X4–X7；r268 同族方法子句裁决先例              |
| E4  | workspace-ui-panels · workspace-ui-core · generation-core · retrieval-and-cache · output-rendering-and-typing · typed-generation-framework · generation-presets-and-constraints · studio-slides-workflow                                                                                           | 42→19 · 29→15 · 37→16 · 29→13 · 23→12 · 20→11 · 10→5 · 31→13      | G8/G10 canonical 与 typed-gen/out-render 引用侧；ui-core 空态三实例折叠                    |
| E5  | source-ingestion-core · source-ingestion-upload-and-url · source-ingestion-management-and-tags · source-ingestion-summary-and-conversion · web-extractor-plugins                                                                                                                                   | 21→9 · 32→16 · 24→12 · 27→13 · 14→8                               | G1/G4/G5/G6 全组；csv-escape 迁移；executable X1–X3；r268 方法子句删除                     |
| E6a | architecture-core · architecture-plugin-and-agent · bdd-test-harness · quality-and-regression · public-repo-hygiene · frontend-eden-migration · configuration-governance · chat-prompt-presets · chat-ui-envelope                                                                                  | 19→10 · 14→7 · 8→4 · 24→11 · 8→4 · 10→5 · 18→8 · 17→9 · 4→2       | G12 全组、G9 r247 侧、G3 presets/envelope 侧；r118 语气消解；bdd s1/s2/s3/qa_unit_dir 清理 |
| E6b | generation-observability-and-guardrails · knowledge-curation-and-freshness · openapi-and-client-generation · slides-workflow-plugins · source-aware-generation-modes · studio-output-types · cross-type-result-transformations · source-connectors · data-and-storage · workspace-command-registry | 18→9 · 13→7 · 15→7 · 6→3 · 14→7 · 17→8 · 14→7 · 16→8 · 14→7 · 9→5 | G2/G7/G9 canonical 侧；r37/r95 去重互引；sqlitevec 魔法数字修复；executable X8–X10         |

## T2 汇总验证 —— 实测结果

- [x] 总场景数 **950 → 472**（区间 [453,503] 内；−50.3%）；`@executable` = **10**（X1–X10 全落地）
- [x] 逐文件实测：dr-ui 140→74 · dr-runtime 119→62 · api-contract 94→43 · panels 42→19 · ui-core 29→15
      · gen-core 37→16 · retrieval 29→13 · out-render 23→12 · typed-gen 20→11 · gen-presets 10→5
      · slides-wf 31→13 · si-core 21→9 · upload 32→16 · manage 24→14† · conv 27→12† · extractors 14→8
      · arch-core 19→10 · arch-plugin 14→7 · bdd 8→4 · quality 24→11 · hygiene 8→4 · eden-mig 10→5
      · config-gov 18→8 · presets 17→9 · envelope 4→2 · observability 18→9 · knowledge 13→7 · openapi 15→7
      · slides-plugins 6→3 · modes 14→7 · output-types 17→8 · xform 14→7 · connectors 16→8
      · data-storage 14→7 · command-registry 9→7†（†=±2 容差内，理由见批次报告）
- [x] `llman sdd validate --specs --strict --no-interactive` → 35 passed / 0 failed
- [x] 双写残留（`必须成立` + 重复行）= 0；r268「DELETE 方法」子句已删；被删 req/标题跨 spec 引用无残留
- [x] `just test-bdd` → 28 pass / 0 fail（与基线一致，runner 未动）

### 遗留（后续 change）

- runner 扫描 `llmanspec/specs` + `onlyTags: ['@executable']` 执行闭环（design.md D3 deferred 项同批）
- X1–X3 接线时校准 `{当前来源[id]}` fixture 路径模板与 re-embed 端点用例
