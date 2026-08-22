# Tasks — specs-compact-2026-08

全量审计基线：37 capabilities / 420 requirements（2026-08）。
（遗留的 type-a 去锚定与 R 组合并见 design.md「D7 后续批次」，不在本 change 完成口径内。）

## ✅ 已完成（commit 8ab5fb8c）

### Batch A — 正确性修复

- [x] 补全 `workspace-api-contract` r18 TOON 截断正文（official catalog 语义）
- [x] 补全 `web-extractor-plugins` r185 截断正文（mode=custom 覆盖语义）
- [x] 消除 `deep-research-ui` r401 与 `deep-research-runtime` r304 默认值矛盾
      （表单初始态 ≠ API 省略默认；UI MUST 显式传参）

### Batch B — 魔法数字归 config schema

- [x] deep-research-runtime：r305（档位映射）/r327（并行度默认 2）/r338（pageRatio 默认 1.5）
      /r339（token 预算 32768/65536）/r340（步数默认 12）/r341（加购 0.25/5/50）
- [x] upload-and-url：50MB → config schema（req + scenario）
- [x] retrieval-and-cache：RRF k=60；chunking 800 字符/重叠 100（scenario）
- [x] studio-slides-workflow：stale 10min（req + scenario）
- [x] architecture-plugin-and-agent：重试最多 3 次 → 配置化有限次数
- [x] source-ingestion-core：CSV 50 rows/chunk、200 char 截断

### Batch C — v1 引用与迁移期叙事清除

- [x] workspace-api-contract：align-v1 req_id ×2 改名；like-v1/v1-aligned 标题中性化；
      r114 去 DEFERRED(c13) 现状句；r75 scenario 去 c65 锚点
- [x] data-and-storage：r124 去 alembic；r225（v1 一次性迁移）整条移除（−1 req）
- [x] deep-research-runtime：r301 501-stub 叙事改正向标题；r324/r325 去 c80/c81/inventory 锚定
- [x] deep-research-ui：r400 去死组件括号与 hook 名；R8 合并——r419 为本地暂存禁令 canonical，
      r442 改引用；r458 去 c103/SKILL.md 路径锚定
- [x] openapi-and-client-generation：r168 并入 r95（api/generated stay-deleted 三重合一，−1 req）；
      generateOpenApiDocument 函数名去锚定
- [x] frontend-eden-migration：fm1/fm3 删除（与 openapi r95 重复，−2 req）；purpose 去迁移叙事；
      notebookId/错误解析条目去实现锚定
- [x] typed-generation-framework r261：refine 退役叙事删除
- [x] chat-prompt-presets r248：DEFERRED/orphan-remove 叙事改当前行为
- [x] chat-ui-envelope：purpose + r84 Rivu kernel 锚定改为 server-authoritative 表述
- [x] generation-core purpose：去 c73 括注
- [x] output-rendering-and-typing：outputs-response-contract 去 c65

### Batch D — capability 级合并（37 → 35）

- [x] 删除 `structural-refinement-for-generated-results`（自述废弃占位 stub）
- [x] `background-jobs-and-task-runtime` 单条守卫并入 architecture-core `r_taskqueue_retired`

验证：`llman sdd validate --specs --strict --no-interactive` → **35 passed, 0 failed**
