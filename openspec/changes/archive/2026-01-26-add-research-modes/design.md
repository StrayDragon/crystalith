# Deep Research Agent 架构设计

## 1. 概述

### 1.1 设计目标

实现一个可交互的深度研究 Agent，用户提交一个主题后，Agent 自主进行多轮研究，并在关键决策点与用户交互。

### 1.2 与现有系统的对比

| 特性 | 快速搜索 (Fast Research) | 深度研究 (Deep Research) |
|------|-------------------------|-------------------------|
| 搜索轮次 | 单次 | 多轮迭代（3-5轮） |
| 关键词扩展 | 无 | Agent 自动生成 |
| 用户交互 | 无 | 关键决策点需用户确认 |
| 结果处理 | 直接返回 | 去重、聚合、排序 |
| 进度显示 | 简单状态 | 实时流式更新 |
| 中间产物 | 无 | 搜索计划、分析报告 |

## 2. 核心概念

### 2.1 Research Session（研究会话）

不同于普通 Chat Session，Research Session 是一个完整的深度研究过程：

```
ResearchSession {
  id: int
  notebook_id: int
  topic: str                    # 研究主题
  status: "planning" | "searching" | "analyzing" | "waiting_user" | "completed" | "cancelled"
  current_iteration: int        # 当前轮次
  max_iterations: int           # 最大轮次
  search_plan: SearchPlan       # 当前搜索计划
  steps: list[ResearchStep]     # 研究步骤历史
  aggregated_results: list[SearchResult]  # 聚合后的结果
  final_report: str | null      # 最终报告
  created_at: datetime
  updated_at: datetime
}
```

### 2.2 Research Step（研究步骤）

每一轮研究的记录：

```
ResearchStep {
  id: int
  session_id: int
  iteration: int
  type: "plan" | "search" | "analyze" | "user_input" | "summary"
  input_data: dict              # 输入数据
  output_data: dict             # 输出数据
  status: "pending" | "running" | "completed" | "skipped"
  created_at: datetime
}
```

### 2.3 Search Plan（搜索计划）

Agent 生成的搜索计划，需要用户批准：

```
SearchPlan {
  iteration: int
  queries: list[SearchQuery]    # 待执行的搜索查询
  reasoning: str                # Agent 的推理说明
  estimated_results: int        # 预估结果数量
}

SearchQuery {
  query: str                    # 搜索关键词
  engine: str                   # 搜索引擎
  priority: int                 # 优先级
  reason: str                   # 为什么要搜这个
}
```

## 3. Agent 图设计

使用 `pydantic-graph` 构建研究流程图：

```
                    ┌─────────────────┐
                    │   StartNode     │
                    │ (接收主题)       │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  PlanSearches   │◄────────┐
                    │ (生成搜索计划)   │         │
                    └────────┬────────┘         │
                             │                  │
                             ▼                  │
                    ┌─────────────────┐         │
                    │  WaitForApproval │         │
                    │ (等待用户批准)    │         │
                    └────────┬────────┘         │
                             │                  │
                   ┌─────────┴─────────┐        │
                   ▼                   ▼        │
          ┌───────────────┐   ┌───────────────┐ │
          │ UserApproved  │   │ UserModified  │ │
          │ (用户批准)     │   │ (用户修改)    │ │
          └───────┬───────┘   └───────┬───────┘ │
                  │                   │         │
                  └─────────┬─────────┘         │
                            ▼                   │
                   ┌─────────────────┐          │
                   │ ExecuteSearches │          │
                   │ (执行搜索)       │          │
                   └────────┬────────┘          │
                            │                   │
                            ▼                   │
                   ┌─────────────────┐          │
                   │ AnalyzeResults  │          │
                   │ (分析结果)       │          │
                   └────────┬────────┘          │
                            │                   │
               ┌────────────┴────────────┐      │
               ▼                         ▼      │
      ┌─────────────────┐       ┌─────────────┐ │
      │ NeedMoreSearch  │       │ Sufficient  │ │
      │ (需要更多搜索)   │───────│ (结果充足)   │ │
      └─────────────────┘       └──────┬──────┘
               │                       │
               └───────────────────────┘
                                       │
                                       ▼
                              ┌─────────────────┐
                              │ GenerateReport  │
                              │ (生成报告)       │
                              └────────┬────────┘
                                       │
                                       ▼
                              ┌─────────────────┐
                              │      End        │
                              └─────────────────┘
```

### 3.1 关键节点说明

#### PlanSearches

- **输入**: 当前主题、历史搜索结果、当前轮次
- **输出**: SearchPlan（搜索计划）
- **AI 任务**: 根据主题和已有结果，生成下一轮搜索关键词
- **关键词扩展策略**:
  - 同义词扩展
  - 相关概念扩展
  - 子主题分解
  - 基于已有结果的深入问题

#### WaitForApproval

- **类型**: 人机交互节点
- **行为**: 暂停执行，等待用户输入
- **用户选项**:
  - 批准计划 (approve)
  - 修改计划 (modify)
  - 添加自定义查询 (add)
  - 跳过本轮 (skip)
  - 结束研究 (finish)

#### AnalyzeResults

- **输入**: 本轮搜索结果
- **输出**: 分析报告 + 是否需要继续搜索
- **AI 任务**:
  - 结果去重
  - 相关性评分
  - 信息覆盖度评估
  - 决定是否需要更多搜索

## 4. 后端 API 设计

### 4.1 新增 API 端点

```python
# 研究会话管理
POST   /v1/notebooks/{id}/research         # 创建研究会话
GET    /v1/notebooks/{id}/research         # 列出研究会话
GET    /v1/notebooks/{id}/research/{rid}   # 获取研究会话详情
DELETE /v1/notebooks/{id}/research/{rid}   # 取消/删除研究会话

# 研究交互
POST   /v1/notebooks/{id}/research/{rid}/approve   # 批准当前计划
POST   /v1/notebooks/{id}/research/{rid}/modify    # 修改当前计划
POST   /v1/notebooks/{id}/research/{rid}/skip      # 跳过当前轮
POST   /v1/notebooks/{id}/research/{rid}/finish    # 提前结束

# SSE 流式更新
GET    /v1/notebooks/{id}/research/{rid}/stream    # 订阅研究进度
```

### 4.2 SSE 事件类型

```typescript
// 进度更新
{ event: "progress", data: { step: "planning", iteration: 1, message: "正在生成搜索计划..." } }

// 计划生成完成，等待用户
{ event: "plan_ready", data: { plan: SearchPlan, waiting_for: "approval" } }

// 搜索进度
{ event: "search_progress", data: { query: "...", completed: 2, total: 5 } }

// 搜索结果
{ event: "search_result", data: { query: "...", results: [...], count: 10 } }

// 分析完成
{ event: "analysis", data: { summary: "...", need_more: true, coverage: 0.65 } }

// 最终报告
{ event: "report", data: { report: "...", total_results: 45 } }

// 完成
{ event: "done", data: { session_id: 123, status: "completed" } }

// 错误
{ event: "error", data: { message: "..." } }
```

## 5. 前端设计

### 5.1 设计风格

采用 **Soft UI Evolution** 风格，适合 SaaS/Dashboard 场景：

- **色彩**: Trust blue (#3B82F6) 主色 + 柔和对比色
- **阴影**: 轻微阴影，比 Flat Design 有层次感但不重
- **过渡**: 200-300ms ease，流畅但不拖沓
- **可访问性**: WCAG AA+ 标准

### 5.2 核心交互原则

基于 UX 最佳实践，遵循以下原则：

| 原则 | 实现方式 |
|------|---------|
| **进度可见** | Step indicators (第 2/4 轮) + 进度条 |
| **即时反馈** | 操作后显示 Toast 确认消息 |
| **AI 协作感** | 显示 Agent 推理过程 + Regenerate 按钮 |
| **可撤销** | 关键操作提供"撤销"或"重试"选项 |
| **键盘友好** | 完整 Tab 导航 + 快捷键支持 |
| **渐进披露** | 默认简洁，按需展开详情 |

### 5.3 新增组件

#### ResearchCapsule（研究胶囊）

**收起状态** - 简洁紧凑，显示关键信息：

```
┌─────────────────────────────────────────────────────────────┐
│ ○ 深度研究                                                   │
│                                                             │
│ 人工智能发展趋势                                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 65%                           │
│ 正在执行第 2/4 轮...  已找到 23 条结果                        │
│                                                             │
│                      [需要您的确认]  [暂停] [···]            │
└─────────────────────────────────────────────────────────────┘
```

**交互细节**：
- 点击卡片任意位置展开详情（`cursor-pointer`）
- Hover 时显示轻微阴影提升（`hover:shadow-md transition-shadow duration-200`）
- [需要您的确认] 使用脉冲动画吸引注意（`animate-pulse`）
- 进度条使用渐变色显示进度（不同阶段不同颜色）
- [···] 菜单包含：暂停、取消、设置

**状态指示器**：

| 状态 | 视觉表现 |
|------|---------|
| Planning | 蓝色脉冲点 ◐ + "正在规划..." |
| Waiting | 橙色静态点 ● + **"需要您的确认"** (高亮) |
| Searching | 蓝色旋转 ○ + "正在搜索 (2/5)..." |
| Analyzing | 紫色脉冲 ◐ + "正在分析..." |
| Completed | 绿色勾 ✓ + "研究完成" |
| Cancelled | 灰色叉 ✕ + "已取消" |

#### ResearchDetailPanel（研究详情面板）

展开为全屏 Overlay（类似 KnowledgeGraphView），提供沉浸式交互：

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ← 返回                    深度研究：人工智能发展趋势                [暂停] [X] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─ 研究进度 ─────────────────────────────────────────────────────────────┐ │
│  │                                                                         │ │
│  │   ● ──────────── ● ──────────── ◐ ──────────── ○ ──────────── ○       │ │
│  │   规划          搜索          分析          规划          完成         │ │
│  │   第1轮         第1轮         第1轮         第2轮                      │ │
│  │                                                                         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌─ 当前：等待确认搜索计划 ────────────────────────────────────────────────┐ │
│  │                                                                         │ │
│  │  Agent 推理                                                             │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │ │
│  │  │ 基于第一轮搜索结果分析：                                         │   │ │
│  │  │ • 发现技术趋势类内容较多，但缺少具体应用案例                      │   │ │
│  │  │ • 建议第二轮聚焦"行业应用"和"最新报告"                           │   │ │
│  │  │                                              [满意] [不满意] [重新生成] │ │
│  │  └─────────────────────────────────────────────────────────────────┘   │ │
│  │                                                                         │ │
│  │  建议的搜索查询                                       [全选] [清空]      │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │ │
│  │  │ [✓] 1. AI 2024 行业应用报告                                     │   │ │
│  │  │        来源: Google · 优先级: 高 · 预期: ~10 条                  │   │ │
│  │  │                                                                 │   │ │
│  │  │ [✓] 2. 大模型企业落地案例                                       │   │ │
│  │  │        来源: Bing · 优先级: 高 · 预期: ~8 条                     │   │ │
│  │  │                                                                 │   │ │
│  │  │ [✓] 3. AI 技术趋势 2024                                         │   │ │
│  │  │        来源: Scholar · 优先级: 中 · 预期: ~5 条                  │   │ │
│  │  │                                                   [+ 添加查询]   │   │ │
│  │  └─────────────────────────────────────────────────────────────────┘   │ │
│  │                                                                         │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │ │
│  │  │  [开始搜索]      [跳过本轮]      [结束研究并生成报告]            │   │ │
│  │  └─────────────────────────────────────────────────────────────────┘   │ │
│  │                                                                         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌─ 已完成的轮次 ──────────────────────────────────────────── [展开全部] ──┐ │
│  │                                                                         │ │
│  │  ▼ 第 1 轮 · 已完成 · 15 条结果                          [查看详情]     │ │
│  │    搜索: "AI发展趋势", "人工智能技术" 等 3 个查询                       │ │
│  │    分析: 覆盖度 45%，建议继续深入"应用案例"方向                         │ │
│  │                                                                         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌─ 快捷操作 ──────────────────────────────────────────────────────────────┐ │
│  │  已收集: 15 条结果 · 高相关: 8 条    [预览结果]  [导出到来源]  [设置]    │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**交互细节**：
- **Agent 推理卡片**: 展示 AI 思考过程，增强透明度和协作感
- **反馈按钮**: [满意]/[不满意] 让用户反馈 Agent 建议质量
- **重新生成**: 如果建议不好，可以要求 Agent 重新规划
- **查询列表**: 可勾选、拖拽排序、直接编辑（点击文字进入编辑模式）
- **主操作按钮**: [开始搜索] 使用主色高亮，其他为次级按钮
- **已完成轮次**: 默认折叠，减少认知负担
- **键盘快捷键**: Enter=开始搜索, Esc=返回, Tab=导航

### 5.4 状态转换与反馈

**Toast 消息**（自动消失，3秒）：

| 操作 | Toast 消息 |
|------|-----------|
| 开始研究 | "深度研究已启动，正在规划第一轮搜索..." |
| 批准搜索 | "开始执行 3 个搜索查询..." |
| 跳过轮次 | "已跳过本轮，进入下一阶段" |
| 结束研究 | "正在生成研究报告..." |
| 研究完成 | "研究完成！共找到 45 条结果" |

**加载状态**：
- 使用 Skeleton Screen 而非空白
- 长时间操作显示预计时间（"预计需要 30 秒..."）
- 搜索进度实时更新（"正在搜索 2/5..."）

### 5.5 用户交互流程（优化版）

```
1. 用户在搜索栏输入主题，点击 [深度研究] 按钮
   → Toast: "深度研究已启动..."
   → 创建研究胶囊，显示在队列中

2. 胶囊显示 "正在规划..." 状态
   → 几秒后变为 "需要您的确认" (橙色高亮+脉冲)

3. 用户点击胶囊，展开详情面板
   → 显示 Agent 推理 + 搜索计划
   → 用户可以：
     a. 直接 [开始搜索] (最常用，主按钮)
     b. 修改/添加/删除查询
     c. [跳过本轮]
     d. [结束研究] 提前结束

4. 执行搜索
   → 实时显示进度 (正在搜索 2/5...)
   → 结果逐条出现（带入场动画）

5. 分析结果
   → 显示 Agent 分析摘要
   → 如果需要更多搜索，自动进入下一轮规划
   → 如果充足，自动进入报告生成

6. 研究完成
   → 动画 + Toast
   → 显示导出选择器
   → 默认选中主报告 + 高相关结果
   → 用户确认后导出
```

### 5.6 智能默认值

减少用户决策负担，提供合理默认值：

| 场景 | 默认值 |
|------|--------|
| 搜索查询数量 | 3 个（可调整 1-5） |
| 最大迭代轮次 | 4 轮（可提前结束） |
| 搜索引擎 | 根据主题自动选择 |
| 导出选择 | 主报告 + 高相关引用 |
| 导入模式 | 链接（不抓取内容） |

### 5.7 移动端适配

- 胶囊全宽显示
- 详情面板为全屏 Bottom Sheet
- 操作按钮固定在底部
- 滑动手势支持（左滑取消、右滑批准）

## 6. 数据库设计

### 6.1 新增表

```sql
-- 研究会话表
CREATE TABLE research_sessions (
    id INTEGER PRIMARY KEY,
    notebook_id INTEGER NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'planning',
    current_iteration INTEGER NOT NULL DEFAULT 1,
    max_iterations INTEGER NOT NULL DEFAULT 5,
    aggregated_results TEXT,  -- JSON array
    final_report TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 研究步骤表
CREATE TABLE research_steps (
    id INTEGER PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES research_sessions(id) ON DELETE CASCADE,
    iteration INTEGER NOT NULL,
    type TEXT NOT NULL,  -- plan, search, analyze, user_input, summary
    input_data TEXT,     -- JSON
    output_data TEXT,    -- JSON
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_research_sessions_notebook ON research_sessions(notebook_id);
CREATE INDEX idx_research_steps_session ON research_steps(session_id);
```

## 7. 技术选型

### 7.1 后端

- **图编排**: `pydantic-graph` (已有依赖)
- **AI Agent**: `pydantic-ai` (已有依赖)
- **流式响应**: FastAPI `StreamingResponse` + SSE
- **状态管理**: 数据库持久化 + 内存缓存

### 7.2 前端

- **状态管理**: React Context + useReducer（与现有 WorkspaceContext 一致）
- **SSE 处理**: EventSource API（与现有 useChat 一致）
- **UI 组件**: Material Tailwind（与现有组件库一致）

## 8. 可测试性设计

### 8.1 后端测试点

1. **单元测试**:
   - SearchPlan 生成逻辑
   - 结果去重算法
   - 覆盖度评估算法

2. **集成测试**:
   - 完整研究流程（mock AI 响应）
   - SSE 事件流正确性
   - 状态转换正确性

3. **端到端测试**:
   - API 端点响应
   - 并发研究会话

### 8.2 前端测试点

1. **组件测试**:
   - ResearchCapsule 渲染
   - ResearchDetailPanel 交互
   - 进度显示

2. **Hook 测试**:
   - useResearch 状态管理
   - SSE 事件处理

## 9. 渐进式实现计划

为了确保每个阶段都可独立测试和部署，采用渐进式实现：

### Phase 1: 基础框架
- 数据库模型
- 基础 API 端点（CRUD）
- 简单的研究图（无交互）

### Phase 2: Agent 逻辑
- 搜索计划生成
- 关键词扩展
- 结果分析

### Phase 3: 人机交互
- SSE 流式更新
- 等待用户输入节点
- 前端交互组件

### Phase 4: 完善和优化
- 最终报告生成
- 结果导出
- 性能优化

## 10. 研究产出导出设计

### 10.1 产出类型

研究完成后会产生多种类型的产出：

```
ResearchOutput {
  type: "report" | "reference" | "link" | "sub_report" | "raw_result"

  # 产出类型说明：
  # - report: 主研究报告（Markdown 格式的综合分析）
  # - reference: 引用（带摘要的高相关性结果）
  # - link: 链接（搜索结果 URL）
  # - sub_report: 子报告（每轮迭代的分析总结）
  # - raw_result: 原始搜索结果

  title: str
  content: str | null        # 报告类型有内容
  url: str | null            # 链接类型有 URL
  metadata: dict             # 来源轮次、引擎、相关度等
  selected: bool             # 用户是否选中
}
```

### 10.2 导出目标

用户可以将产出导出到不同位置：

| 产出类型 | 可导出到 | 默认行为 |
|---------|---------|---------|
| report (主报告) | 来源 / 输出 | 导入到来源 |
| reference (引用) | 来源 | 可选导入 |
| link (链接) | 来源 | 可选批量导入 |
| sub_report (子报告) | 来源 / 输出 | 可选导入 |
| raw_result (原始结果) | 来源 | 可选批量导入 |

### 10.3 导出选择器 UI

研究完成后显示导出选择器对话框：

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 研究完成：人工智能发展趋势                                               │
│                                                                         │
│ 选择要导出的内容                                            [全选] [取消选择] │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ 📄 研究报告                                                              │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ [✓] 主研究报告：人工智能发展趋势综述                                  │ │
│ │     2,450 字 · 12 个引用 · 生成于 2 分钟前                           │ │
│ │     导出到: [来源 ▼] [输出 ▼]                                        │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ 📋 子报告 (3)                                              [展开/收起]   │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ [✓] 第1轮分析：技术趋势概述                                          │ │
│ │ [✓] 第2轮分析：应用场景深入                                          │ │
│ │ [ ] 第3轮分析：市场预测                                              │ │
│ │     导出到: [来源 ▼]                                                 │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ 🔗 引用链接 (45)                                           [展开/收起]   │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ [✓] 高相关 (12)                                                      │ │
│ │     - AI 2024 发展报告 (score: 0.95)                                 │ │
│ │     - 大模型技术白皮书 (score: 0.92)                                 │ │
│ │     - ...                                                            │ │
│ │ [ ] 中相关 (18)                                                      │ │
│ │ [ ] 低相关 (15)                                                      │ │
│ │     导出到: [来源 ▼] 模式: [抓取内容 ▼]                               │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│ 已选择: 主报告 + 2 子报告 + 12 链接                                      │
│                                                                         │
│                              [取消]  [仅导出报告]  [导出选中项]           │
└─────────────────────────────────────────────────────────────────────────┘
```

### 10.4 导出 API

```python
# 导出研究产出
POST /v1/notebooks/{id}/research/{rid}/export
{
  "exports": [
    {
      "output_type": "report",           # 产出类型
      "output_id": "main_report",        # 产出 ID
      "target": "source",                # 目标: source | output
      "target_options": {                # 目标特定选项
        "output_type": "structured"      # 如果导出到 output，指定类型
      }
    },
    {
      "output_type": "link",
      "output_ids": ["link_1", "link_2", "link_3"],
      "target": "source",
      "target_options": {
        "mode": "fetch",                 # fetch | link
        "extractor": "jina"              # 如果 fetch，使用的提取器
      }
    }
  ]
}

Response:
{
  "exported": [
    { "output_id": "main_report", "target": "source", "source_id": 123, "success": true },
    { "output_id": "link_1", "target": "source", "source_id": 124, "success": true },
    { "output_id": "link_2", "target": "source", "source_id": null, "success": false, "error": "Fetch failed" }
  ],
  "summary": {
    "total": 4,
    "success": 3,
    "failed": 1
  }
}
```

### 10.5 导出到不同目标的处理

#### 导出到来源 (Source)

1. **报告类型** (report, sub_report):
   - 创建 Source 记录，type="research_report"
   - 内容作为 Markdown 存储
   - 自动分块和向量化

2. **链接类型** (link, reference):
   - 模式 "link": 仅创建 Source 记录，status="pending"
   - 模式 "fetch": 调用提取器抓取内容，完整处理

#### 导出到输出 (Output)

1. **报告类型**:
   - 可选择输出类型：structured, bullets, paragraph
   - 调用现有 Output 生成流程
   - 保留引用关系

### 10.6 快捷操作

除了完整的导出选择器，还提供快捷操作：

1. **一键导入报告**: 仅导入主研究报告到来源
2. **导入全部高相关**: 导入主报告 + 所有高相关引用
3. **自定义选择**: 打开完整导出选择器
