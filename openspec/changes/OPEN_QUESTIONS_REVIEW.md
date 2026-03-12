# OpenSpec Changes — 开放问题讨论与决策

> **目的**：梳理所有活跃 change 中的不确定项、开放问题和模糊边界，逐一讨论并确定结论。
> **使用方式**：在每个问题的 `📌 决策` 区域写入你的决定，完成后我会将结论同步回各 change 文件。

---

## 目录

- [A. typed-generation-framework（核心上游依赖）](#a-typed-generation-framework)
- [B. source-connectors-framework ↔ obsidian-vault-plugin](#b-source-connectors-framework--obsidian-vault-plugin)
- [C. quality-gates-for-generation ↔ evidence-review-workflow](#c-quality-gates--evidence-review)
- [D. generation-presets-and-constraints](#d-generation-presets-and-constraints)
- [E. generation-variants-and-comparison](#e-generation-variants-and-comparison)
- [F. source-aware-generation-modes](#f-source-aware-generation-modes)
- [G. cross-type-result-transformations](#g-cross-type-result-transformations)
- [H. structural-refinement-for-generated-results](#h-structural-refinement)
- [I. background-jobs-and-task-runtime](#i-background-jobs-and-task-runtime)
- [J. knowledge-curation-and-freshness](#j-knowledge-curation-and-freshness)
- [K. multi-notebook-collections](#k-multi-notebook-collections)
- [L. publishable-artifacts](#l-publishable-artifacts)
- [M. 跨 change 结构性问题](#m-跨-change-结构性问题)

---

## A. typed-generation-framework

> 这是多个下游 change 的共同上游，优先级最高。下游 change 包括：generation-presets-and-constraints、structural-refinement、cross-type-result-transformations、source-aware-generation-modes。

### A1. "生成类型" vs "输出类型" 的具体边界

**现状**：design 确认了两者必须分离 (D3)，但没有给出具体定义和映射关系。

**示例分析**：
- 当前系统已有的输出类型：`briefing`, `guide`, `flashcard`, `mindmap`, `quiz`, `timeline`, `slides`, `FAQ`
- 这些是"输出类型"（结果如何被渲染和承载），而不是"生成类型"

**建议方案**：

| 概念 | 定义 | 示例 |
|------|------|------|
| **生成类型 (GenerationType)** | 描述"这次在做什么生成工作"，决定输入要求、检索策略、证据需求和完成语义 | `research`（深度研究）, `synthesis`（综合归纳）, `creative`（发散创作）, `qa`（问答）|
| **输出类型 (OutputType)** | 描述"结果最终如何被渲染和承载"，由 OutputTypePlugin 提供 | `briefing`, `guide`, `flashcard`, `mindmap`, `quiz`, `timeline`, `slides` |
| **映射关系** | 一个生成类型可以对应多个输出类型，但不是任意组合 | `research` → briefing / timeline；`synthesis` → guide / mindmap |

**📌 决策**：

你的建议方案我赞同 , 这个功能就是提供一种只能的获取来源的能力

---

### A2. 最小公共词汇的具体字段

**现状**：design (D2) 说"至少包含输入要求、输出结构、控制面和完成语义"，但未列举。

**建议方案 — GenerationType 契约最小字段集**：

```yaml
GenerationType:
  id: string                  # 类型标识，如 "research", "synthesis"
  display_name: string        # 用户可见名称
  input_requirements:         # 输入要求
    min_sources: int          # 最少来源数量
    source_mode: enum         # strict_evidence | synthesis | brainstorming（连接 source-aware-generation-modes）
    user_prompt_required: bool
  output_contract:            # 输出结构契约
    compatible_output_types: list[OutputTypeId]   # 兼容的输出类型
    default_output_type: OutputTypeId             # 默认输出类型
    structured_schema: SchemaRef | null           # 结构化输出 schema（如有）
  control_surface:            # 可配置控制面（连接 generation-presets-and-constraints）
    available_knobs: list[KnobDefinition]         # 可调参数定义
    default_preset: PresetId | null               # 默认预设
  completion_semantics:       # 完成语义
    citation_required: bool                       # 是否要求引用
    quality_gates: list[QualityGateId]            # 适用的质量门
    allows_refinement: bool                       # 是否支持局部改良
```

**📌 决策**：

ok

---

### A3. 公共框架 vs 下游扩展的边界

**现状**：design (D4) 说公共框架不接收特例回写，但何为"公共"何为"特例"未定义。

**建议原则**：
- **公共框架负责**：类型注册/发现、契约结构定义、请求装配/路由、结果元数据标准
- **下游 change 负责**：具体 knob 定义 (presets)、具体 refinement 动作 (structural-refinement)、具体转换路径 (cross-type)、具体来源模式定义 (source-aware)
- **判定规则**：如果某字段所有生成类型都需要且语义一致 → 公共框架；如果仅部分类型需要或语义不同 → 下游扩展位

**📌 决策**：

ok 遵循建议
---

## B. source-connectors-framework ↔ obsidian-vault-plugin

### B1. 两个 change 的职责拆分

**现状**：两个 change 都描述了 `SourceConnectorPlugin`、binding、snapshot、sync_check 等同一套概念，职责重叠。

**建议方案**：

| 职责 | 归属 |
|------|------|
| `SourceConnectorPlugin` 接口定义、宿主通用工作流 UI、binding/snapshot/sync_check 模型 | **source-connectors-framework** |
| Obsidian 特有：vault 路径参数、wikilink/embed/frontmatter 预处理、vault 枚举逻辑 | **obsidian-vault-plugin** |
| Markdown 预处理共用能力（已落地） | **source-connectors-framework** 或独立 utility |

**建议**：
- 方案 A：合并为一个 change，因为 Obsidian 是框架的唯一验证者，拆开讨论会造成两头都"待定"
- 方案 B：保持拆分，但在 obsidian-vault-plugin 的 proposal 中明确标注"框架定义由 source-connectors-framework 拥有，本 change 只消费框架"

**📌 决策**：

A
---

### B2. 第二个连接器的规划

**现状**：obsidian-vault-plugin task 5.5 要求"验证第二个非 Obsidian 连接器可复用宿主通用 UI"，但未指定是哪个。

**候选连接器**：
- **本地文件夹 (Local Directory)**：最简单的验证路径，只需枚举 + 读取
- **Git 仓库 (Git Repo)**：有版本语义，可以测试 sync_check 的 diff 能力
- **Notion API**：代表 SaaS 类连接器，需要认证和分页

**建议**：用 Local Directory 作为第二验证连接器——实现成本最低，能有效检验框架是否真的足够通用。

**📌 决策**：

ok 遵循建议
---

## C. quality-gates ↔ evidence-review

### C1. 质量门与审阅流程的边界

**现状**：
- quality-gates design (D1)：质量门是运行时信号，不替代正式审阅
- evidence-review design (非目标)：不把质量门等同于 evidence review
- 但两者的实际交互未定义

**建议边界**：

```
生成完成 → [自动] 质量门检查 → 通过/警告/阻断
                                    ↓
                              结果可见但带标记
                                    ↓
                         [手动] 用户发起 evidence review
                                    ↓
                          逐条审阅 citation / evidence
                                    ↓
                         draft → pending_review → confirmed / needs_revision
```

- **质量门**：自动、运行时、面向结果整体、输出结构化信号
- **审阅流程**：手动、面向具体证据/引用、状态由用户显式推进
- **连接点**：质量门的"警告"可以作为建议用户审阅的触发提示，但不强制

**📌 决策**：

接受此边界

---

### C2. 质量门的分级：告警 vs 阻断

**现状**：tasks 1.2 要求"明确哪些质量门只告警、哪些可以阻断"，未回答。

**建议分级**：

| 质量门 | 级别 | 理由 |
|--------|------|------|
| Schema 合规性检查（结果结构是否完整） | **阻断** | 不合规的结构无法正确渲染 |
| Citation 覆盖率（引用率低于阈值） | **警告** | 低引用不意味无法使用 |
| 来源充分性（可用来源少于预期） | **警告** | 用户可能知情且接受 |
| 关键字段缺失（标题/摘要为空） | **阻断** | 缺少关键信息的结果不可用 |
| 长度偏差（过长或过短于目标） | **警告** | 用户可通过 refinement 调整 |

**📌 决策**：

接受此分级
---

### C3. Evidence review 的最小状态集

**现状**：design 说需要审阅状态，但未列出具体状态。

**建议**：

```
结果生成后的默认状态:  draft
用户开始审阅:          pending_review
所有 citation 确认通过: confirmed
发现需要修订的 citation: needs_revision
修订后重新确认:         confirmed
```

**状态转移规则**：
- `draft` → `pending_review`：用户显式点击"开始审阅"
- `pending_review` → `confirmed`：所有标记的 citation 均已确认
- `pending_review` → `needs_revision`：至少一条 citation 被标记为需修订
- `needs_revision` → `pending_review`：用户完成修订后重新提交审阅

**📌 决策**：

接受

---

## D. generation-presets-and-constraints

### D1. 每类生成的高价值控制项集合

**现状**：design (D4) 说"v1 先覆盖高价值控制项"，但未列出。

**建议 — v1 控制项清单**：

| 控制项 | 适用类型 | 产品显式 vs 内部策略 |
|--------|---------|---------------------|
| **输出长度** (short / medium / detailed) | 全部 | 产品显式 |
| **证据严格度** (strict / balanced / relaxed) | research, synthesis | 产品显式 |
| **目标受众** (expert / general / beginner) | briefing, guide | 产品显式 |
| **表达风格** (formal / conversational / academic) | briefing, creative | 产品显式 |
| **结构偏好** (flat / hierarchical / narrative) | briefing, guide, timeline | 产品显式 |
| 检索 top_k / min_score | 全部 | **内部策略**（由预设映射） |
| 模型温度 | 全部 | **内部策略** |
| Prompt 模板选择 | 全部 | **内部策略** |

**划分原则**：
- **产品显式控制**：用户能理解且有意义地选择的参数
- **内部策略**：底层技术参数，由预设间接控制

**📌 决策**：

接受

---

### D2. 预设的命名和组织方式

**现状**：risk 提到"若预设命名不清，反而会让用户更困惑"。

**建议方案**：
- 预设命名采用 `{目标场景}` 风格，而非技术参数堆叠
- 示例：`快速摘要` / `深度研究报告` / `学习指南（入门）` / `学术论文风格`
- 每个预设展示 2-3 个关键控制项的值（如"长度: 详细 | 证据: 严格 | 风格: 学术"）
- v1 系统提供 3-5 个内置预设，不支持用户自定义

**📌 决策**：

接受, v1 就支持自定义

---

## E. generation-variants-and-comparison

### E1. 何时启用多 variant 流程

**现状**：design (D4) 说"何时值得进入多 variant 流程，需要产品显式定义"。

**建议触发规则**：
- **默认**：所有生成均产出单结果
- **用户主动**：用户在生成前显式选择"生成多个候选"
- **系统建议**：当结果质量门返回"警告"时，建议用户尝试多 variant
- v1 **不**自动触发多 variant

**📌 决策**：

接受

---

### E2. Variant 成本与数量限制

**现状**：tasks 2.3 要求明确限制，未回答。

**建议**：
- v1 最多同时生成 **3** 个 variant
- 每个 variant 产生独立的 LLM 调用成本
- UI 需要在触发前显示预估成本（如"将消耗约 3x 正常生成量"）
- Variant 与主结果共享来源检索结果（只额外消耗生成成本）

**📌 决策**：

接受

---

## F. source-aware-generation-modes

### F1. v1 来源模式集合

**现状**：design (D4) 说"先明确少量高价值来源模式"，未列出。

**建议 — v1 三种模式**：

| 模式 | 行为描述 | 适用生成类型 | 检索策略 | Citation 要求 |
|------|---------|-------------|---------|--------------|
| **strict_evidence** | 严格依赖来源，每个论点必须有引用 | research | 高精度、高 recall | 强制 |
| **synthesis** | 综合来源但允许模型归纳 | briefing, guide | 宽松检索 | 建议但不强制 |
| **brainstorming** | 来源仅作背景参考，模型可自由发挥 | creative, qa | 可选检索 | 不要求 |

**映射关系**：每种生成类型有一个默认来源模式，用户可覆盖。

**📌 决策**：

接受此三种

---

### F2. 跨模式场景的处理

**现状**：risk 提到"某些生成类型可能横跨多种来源模式"。

**建议**：v1 每次生成只使用一种来源模式（不支持混合）。如果用户对同一内容需要不同来源模式，通过 variant 或转换来实现。

**📌 决策**：
接受

---

## G. cross-type-result-transformations

### G1. v1 支持的转换路径

**现状**：design (D1) 说"只支持有限、明确的转换路径"，但未列出。

**建议 — v1 转换路径**：

| 源类型 | 目标类型 | 保留内容 | 需要重建 |
|--------|---------|---------|---------|
| research notes (briefing) | slides | 核心观点、证据 | 视觉结构、每页布局 |
| research notes (briefing) | guide | 知识结构、引用 | 学习路径、难度分层 |
| timeline | briefing | 事件数据、时间线索 | 叙述结构、分析归纳 |
| QA 对话记录 | briefing | 关键 Q&A、引用 | 连贯叙述 |

**不支持的路径（v1）**：
- flashcard → briefing（信息密度差异过大）
- mindmap → slides（结构映射不自然）
- 任意 → quiz（需要重建评估逻辑）

**📌 决策**：
接受

---

## H. structural-refinement

### H1. 结构单元与 refinement 动作

**现状**：tasks 1.1 要求定义结构单元和动作集合，未回答。

**建议 — 结构单元**：
- `section`（章节/段落）
- `evidence_block`（引用/证据块）
- `conclusion`（结论/摘要）
- `list_item`（列表项）

**建议 — refinement 动作集合**：

| 动作 | 作用范围 | 描述 |
|------|---------|------|
| `expand` | section / evidence_block | 展开一个结构单元，增加深度 |
| `compress` | section | 压缩，保留核心观点 |
| `rewrite` | section / conclusion | 重写以改变风格/严谨度 |
| `reorder` | 同级 sections | 调整章节顺序 |
| `regenerate_local` | 任意单元 | 保留上下文，仅重新生成该单元 |

### H2. 局部 refinement vs 整篇重生成的判定规则

**建议规则**：
- 如果操作影响 **1-2 个相邻结构单元** → 局部 refinement
- 如果操作影响 **>50% 的结构单元** 或 **改变核心论点** → 建议整篇重生成
- 如果局部 refinement 后 **引用链断裂** → 提示用户选择：修复引用 or 整篇重生成

**📌 决策**：
接受

---

## I. background-jobs-and-task-runtime

### I1. 任务与业务流程的装配关系

**现状**：tasks 2.2 说"明确任务与具体业务流程之间的装配关系"。

**建议模型**：

```
JobDefinition（通用）
  ├── type: string        # "generation" | "import" | "sync_check" | "batch_generation"
  ├── params: dict        # 业务参数（传给具体执行器）
  └── executor: string    # 执行器标识

JobExecutor（按业务注册）
  ├── GenerationExecutor     → 消费 generation-core 管线
  ├── ImportExecutor         → 消费 source-connectors 导入流程
  ├── SyncCheckExecutor      → 消费 connector sync_check
  └── BatchGenerationExecutor → 批量编排多个 GenerationExecutor
```

**装配原则**：Job runtime 提供 lifecycle + progress + retry；具体业务逻辑由 Executor 实现。Job 不了解业务细节，Executor 不关心任务状态管理。

**📌 决策**：
接受

---

### I2. 通用任务 UI vs 业务界面

**现状**：tasks 3.2 说"明确哪些动作由通用任务 UI 承担，哪些仍由业务界面承接"。

**建议分工**：

| 功能 | 归属 |
|------|------|
| 任务列表、状态展示、进度条 | **通用任务 UI** |
| 取消、重试按钮 | **通用任务 UI** |
| 任务历史查看 | **通用任务 UI** |
| 生成结果预览/操作 | **业务界面**（Studio） |
| 导入范围选择/确认 | **业务界面**（Connector UI） |
| 同步检查 diff 展示 | **业务界面**（Connector UI） |

**📌 决策**：
接受

---

## J. knowledge-curation-and-freshness

### J1. Freshness 对象模型

**现状**：tasks 1.1 要求定义对象模型，未回答。

**建议**：

```yaml
FreshnessSignal:
  source_id: string
  last_ingested_at: datetime
  source_modified_at: datetime | null   # 来自 connector sync_check
  staleness_score: float                # 0.0 (fresh) ~ 1.0 (stale)
  staleness_reason: enum                # time_decay | source_updated | manual_flag
  suggested_action: enum                # none | re_ingest | re_embed | review

DuplicateCandidate:
  source_a_id: string
  source_b_id: string
  similarity_score: float
  overlap_type: enum                    # exact | near_duplicate | partial_overlap
  suggested_action: enum                # merge | ignore | review
```

### J2. 建议 vs 实际处理动作

**建议边界**：
- v1 所有治理动作都是 **建议**，用户确认后才执行
- 执行动作使用 background-jobs-and-task-runtime 的 Job 模型
- 不引入自动执行策略

**📌 决策**：

接受, 需要自动处理场景

---

## K. multi-notebook-collections

### K1. Collection 级上下文与 Notebook 上下文的共存

**现状**：tasks 1.2 要求明确共存模型，未回答。

**建议**：
- 在 collection 上下文中进行生成/检索时，系统合并所有成员 notebook 的来源
- 来源保留 notebook 归属标签：`source.notebook_id` 始终可追溯
- collection 级配置（如默认生成类型、预设）可覆盖 notebook 级默认值
- 冲突处理：collection 级 > notebook 级 > 系统默认

**📌 决策**：
接受

---

### K2. 结果的 Notebook 来源归属

**建议**：
- collection 级生成的结果标记 `generated_in: collection_id`
- 结果中每条 citation 保留 `source_notebook_id`，用户可以追溯到具体 notebook
- 结果本身不归属于某个 notebook，而是归属于 collection

**📌 决策**：
接受, 需有有notebook的引用

---

## L. publishable-artifacts

### L1. Artifact 生命周期状态

**现状**：design 提到了 lifecycle 概念但未具体定义状态。

**建议**：

```
draft → reviewed → finalized → archived
  ↑        ↓
  └── needs_edit
```

| 状态 | 含义 |
|------|------|
| `draft` | 从结果提升而来，可继续编辑 |
| `reviewed` | 完成 evidence review（连接 evidence-review-workflow） |
| `finalized` | 锁定版本，不再编辑 |
| `needs_edit` | 审阅后发现需要修改，回到编辑状态 |
| `archived` | 归档，保留但不再活跃 |

### L2. Artifact 与普通结果的边界

**建议判定原则**：
- 普通结果是探索过程的产物，可能有多个、可丢弃
- Artifact 是值得沉淀的正式产物，有版本、有审阅状态、可被引用
- **提升 (promotion)** 是显式用户动作，系统不自动提升
- 一个结果一旦被提升为 artifact，原结果保留但标记"已提升"

**📌 决策**：

接受状态集

---

## M. 跨 change 结构性问题

### M1. 依赖排序与实施顺序

**现状**：14 个 change 互相依赖，但没有明确的实施顺序。

**建议实施层次**：

```
第 1 层（基础层，无上游依赖）：
  ├── typed-generation-framework      ← 生成类型公共词汇
  ├── background-jobs-and-task-runtime ← 任务运行时
  └── source-connectors-framework     ← 连接器框架

第 2 层（消费第 1 层）：
  ├── quality-gates-for-generation    ← 消费类型契约
  ├── generation-presets-and-constraints ← 消费类型控制面
  ├── source-aware-generation-modes   ← 消费类型 + 连接器
  ├── obsidian-vault-plugin           ← 消费连接器框架
  └── multi-notebook-collections      ← 独立但依赖来源稳定

第 3 层（消费第 2 层）：
  ├── evidence-review-workflow        ← 消费质量门
  ├── structural-refinement-for-generated-results ← 消费类型契约 + 结果结构
  ├── generation-variants-and-comparison ← 消费类型 + 预设
  └── knowledge-curation-and-freshness ← 消费连接器 + 来源对象

第 4 层（消费多个第 2-3 层）：
  ├── cross-type-result-transformations ← 消费类型 + 结果结构 + artifact
  └── publishable-artifacts            ← 消费审阅 + 结果 + 生命周期
```

**📌 决策**：
接受此顺序

---

### M2. "后置"的统一定义

**现状**：多个 design 使用"后置"表达 v1 不做的内容，但缺少统一语义。

**建议**：在每个 change 的 design 中，"后置"必须附带以下信息：
1. 后置到什么时候（下一个 change / 用户反馈后 / 特定条件满足后）
2. 后置项是否已知需要（确认需要但延迟）还是不确定是否需要（待观察）

**📌 决策**：

接受 ,需要更结构化的后置管理

---

### M3. Validate 命令的实际存在

**现状**：每个 change 的 tasks 末尾都引用 `openspec validate <change-name>`，但不确定该命令是否实际存在。

**📌 决策**：

存在的 你可以 通过 /home/l8ng/.local/share/pnpm/openspec -h 查看

---

## 编辑指引

完成决策后，请在每个 `📌 决策` 区域写入你的结论，支持以下格式：
- ✅ 直接写"接受"表示同意建议方案
- ✏️ 写修改意见
- ❌ 写"拒绝"并说明替代方案
- 💬 写"需要进一步讨论"并附上你的疑问

完成后告诉我，我会将所有决策同步回各 change 文件。
