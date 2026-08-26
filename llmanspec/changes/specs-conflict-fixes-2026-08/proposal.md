---
depends_on: []
rules_edit_acked: true
---

# Proposal — specs-conflict-fixes-2026-08

## Why

b3 压缩后的全仓矛盾排查（capability 内部 + 跨文件双轴）确认 6 组 `@human` 确证矛盾与
约 10 处措辞级张力。其中 A1 为 r268 同类的迁移期实锤漂移（spec 要求前端传 notebookId
query，实现已走嵌套 canonical 路径）；A2 的 SLIDES 可用性在两文件中正面冲突，实现为
core 驱动 tools 列表。

## What Changes

### A 类 · 确证矛盾

1. **A1** frontend-eden-migration：sources 单资源调用改写为嵌套路径语义
   （MUST NOT 附 notebookId query 平行参数），归属校验引用 api-contract nested-path SSOT。
2. **A2** workspace-api-contract r17 拆面：tools **列表**由 core 输出类型注册表驱动
   （含 SLIDES，对齐实现）；插件可用性门禁归生成侧 generation-core r31。
3. **A3** api-contract nested-path 同句「MAY/SHOULD」→「SHOULD（兼容读取）」。
4. **A4** studio-slides-workflow frontmatter override 分支作用域化：
   「MUST NOT 省略 colorSchema/class/serif/mono」限定预设路径；override 以用户字符串为准。
5. **A5** dr-runtime r318：「MUST 串行」→「串行或有界并行（见 r327/r336）；同 Run
   模型调用 MUST 经队列串行化」。
6. **A6** si-manage tag binding 跨 notebook 拒绝码收紧为 404（引用 nested-path SSOT）；
   G6 引用侧（si-conv tag-binding 条目）瘦身为纯委托。

### B 类 · 措辞澄清

dr-ui r412 深链豁免扩至显式动作/slash 导航 · dr-runtime r304 删「对齐 Lab Compose」括注 ·
ui-panels loading 注明 processing 展示别名 · api-contract camelCase 总则补 content payload
内部键豁免 · gen-core citation 兜底加有证据路径限定 · upload r50 错误码枚举补 413 ·
typed-gen citation 清洗条改为「细化 gen-core r250」语气 · slides-wf r183「默认 10min」→
config 表述 · retry-* 通配引用改显式 req_id · 「openapi」缩写改全名 · gen-obs 补 canonical
自标 · api-contract r73 标注 canonical 嵌套路径族 · dr-ui r409 注明 Eden 打开动作为 MUST。

## BREAKING

无代码/wire 改动；纯 spec 文本修正。A1/A2 均为对齐已验证实现现状的规范修正。

## Non-Goals

- report working-copy API 的 runtime canonical requirement（ADDED 类，另走 propose）
- curation re_embed 口子定义、document_parse 与 TaskQueue retired 边界措辞（需设计判断）
- runner 执行闭环 change

## Verification

- `llman sdd validate --specs --strict --no-interactive` 全绿
- 复扫确认 A1–A6 原矛盾片段不再出现（grep 定向复查）
- 场景总数变化 ≤ ±2（本变更以改写为主，不删场景）
