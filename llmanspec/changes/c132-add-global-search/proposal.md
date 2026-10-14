---
title: 全局搜索：SearchService + /v2/search API + 分组召回 UI
depends_on: [c130-extend-embedding-capability]
---

# 全局搜索：SearchService + /v2/search API + 分组召回 UI

> **草案**（2026-10-13，对应 issue #6）。待正式 `/llman-sdd-propose` 充实 design/tasks。
> 已锁定决策（2026-10-13）：索引面走 **决策 A（chunk origin 泛化）**——c130 预埋 `origin_type/origin_id` 列，本 change 启用（产出以 `origin_type='output'` chunks 入索引）；**notebooks 为平铺结构**（无 parent_id），#6 所述「递归」全局即「跨全部笔记本」，无树遍历需求。

## Why

- issue #6：搜索产品面——当前笔记本 / 全局两种范围，一次查询多目标召回（资料块、笔记产出等），分组结果可跳转。
- 现状差距（2026-10-13 代码盘点）：
  - **本地知识库搜索 API 不存在**：`/v2/notebooks/:nid/sources/search` 实为 SearXNG 联网搜索；语义检索只存在于 QA/outputs/studio 管线内部。
  - 所有检索 notebook-scoped（`RAGStrategy.retrieve(query, notebookId)`；`vec_chunks` 按 notebook_id+source_id 分区）——全局 KNN 只需去分区谓词，个人 KB 规模无压力。
  - **仅 source chunks 被索引**：studio 产出需显式 convert-to-source 才可搜（outputs/router.ts:570）。
  - **FTS5 默认 unicode61 分词器对中文基本无效**（连续汉字整段成单 token）——hybrid 搜索在中文语料上质量差，必须纳入本 change。

## What Changes（预研骨架）

1. **SearchService**（`rag/registry` 之上的独立服务，不动 `RAGStrategy` 接口）：
   - `scope: notebook_id | all`；固定 hybrid 路径（embed + keyword RRF 融合）——**不读 per-notebook strategy_configs**（全局搜索不应被单笔记本配置劫持）；
   - top-k / minScore；结果按笔记本、对象类型（source chunk / output）、modality 分组，带跳转引用与所属笔记本上下文。
2. **API**：`POST /v2/search`（全局）+ notebook 范围参数复用同端点；shared Zod schema（packages/shared）+ `registerApiDoc`；Eden 类型自动透出。
3. **索引面启用 origin 泛化**（决策 A 兑现）：outputs 生成后自动以 `origin_type='output'` chunks 入索引（含 modality/model/dims 元数据）；产出删除/更新 → 对应 chunks 级联；**QA citation 路径过滤 `origin_type='source'`，行为零变化**（citation 引用语义不破坏，#6 验收项）。
4. **中文 FTS 修复**：FTS5 换 trigram tokenizer（或索引期 char-bigram），`chunks_fts` 重建；BM25/hybrid 中文质量验证用例。
5. **性能边界**（#6 验收项）：超时/取消策略 + 文档写清索引对象范围（哪些产出/来源会被搜到）。
6. **Web UI**：搜索入口、范围切换（当前笔记本/全局）、分组结果列表与跳转。
7. **specs**：新增 `global-search` capability。

## Design 输入清单（正式 propose 时展开）

1. 搜索 wire 形态：分组字段（notebook/type/modality 三级 or 扁平 + facet）、跳转引用（source chunk → sources 面板锚点；output → 产出视图）、分页 or top-k 截断 + 「更多」。
2. outputs 自动索引触发点：pipeline postprocess 完成后 vs status=ready 时；产出重新生成时旧 chunks 的失效策略（删旧插新 + vector_epoch bump）。
3. research artifacts（深研产出）是否纳入 origin 类型（v1 倾向：仅 studio outputs，research 归 c132 后续）。
4. FTS tokenizer 选型：trigram（内建，查询需 ≥3 字符）vs 索引期 char-bigram（查询侧同样 bigram 化，短查询友好）——中文场景实测定夺。
5. 超时/取消：请求级 AbortSignal 传播到 KNN/FTS 查询（sqlite 同步执行的取消边界：v1 用预算上限 + 截断文档化）。
6. 全局 KNN 去分区谓词后的延迟实测（vec0 全分区扫描）；若超标再考虑 notebook 级并行扇出。
7. 与 c129（pg）衔接：SearchService 方言中立（经 DbClient/strategy），pgvector 迭代扫描天然吃 `source_id IN`。

## 真实业务验证发现（2026-10-13 浏览器回归，c131 归档后）

- **A（中，web）已修**（2026-10-13 main）：IndexRebuildControl 警告色被 IconButton 基类压过 → `!` important 前缀（MindmapViewer 同款先例）。
- **B（高，server）已修**（2026-10-13 main `df7b7a77`）：`searchVectors` 多来源合并改轮转配额（按来源名次交错取、每来源保底名额，选完再全局距离排序保 r229）；真机复现 `sourceIds:[1,3]` 引用恢复 `[1,1,1,3]`。回归测试 `tests/rag/multi-source-search.test.ts`。c132 的 SearchService 复用该合并语义。
- **C（中，web）已修主根**（2026-10-13 main `09efe3c0`）：workspace 选中态（activeNotebookId/activeSessionId）经 zustand persist 持久化——此前刷新即重置到最新笔记本、聊天区清空（消息服务端在，视图丢）。子代理观察到的"列表闪空后恢复旧状态"归并同根；若 c132 搜索 UI 期间复现独立渲染残留，再开专项。
- **D（低，web）已修**（同 `09efe3c0`）：重建确认按钮传 `confirmText="开始重建"`（ConfirmPopover 既有 prop）。

## 深挖决策记录（2026-10-13，逐问确认）

1. **搜索入口形态**：workspace **顶栏常驻搜索框**，输入即搜；范围切换（当前笔记本/全局）在结果面板里选。（用户选定。）
2. **结果分组**：按笔记本、对象类型、modality 分组（wire 细节留 design）。
3. **FTS tokenizer 选型**：trigram vs 索引期 char-bigram，用中文样例实测召回后定（实现细节，不问用户）。

## 关联

- issue #6；依赖 c130-extend-embedding-capability（origin/modality 列 + 能力层）；建议在 c131 之后落地
- **archive 约定（2026-10-13 用户指令）**：收口 commit 正文追加 `fixes #6`（GitHub 自动关闭 issue）。
