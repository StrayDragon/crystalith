## Phase 1: 基础框架（数据层 + 简单 API）

### 1.1 数据库模型

- [x] 1.1.1 创建 `ResearchSession` SQLAlchemy 模型
  - 字段: id, notebook_id, topic, status, current_iteration, max_iterations, aggregated_results, final_report, created_at, updated_at
  - 验证: 模型定义正确，可执行 CRUD
- [x] 1.1.2 创建 `ResearchStep` SQLAlchemy 模型
  - 字段: id, session_id, iteration, type, input_data, output_data, status, created_at
  - 验证: 外键关系正确，级联删除
- [x] 1.1.3 创建数据库迁移脚本
  - 验证: `just db-init` 成功创建表

### 1.2 基础 API 端点

- [x] 1.2.1 创建 `backend/py/src/crystalith/api/research.py` 路由模块
- [x] 1.2.2 实现 `POST /v1/notebooks/{id}/research` - 创建研究会话
  - 输入: topic, max_iterations (可选)
  - 输出: ResearchSession 对象
  - 验证: curl 测试返回 201
- [x] 1.2.3 实现 `GET /v1/notebooks/{id}/research` - 列出研究会话
  - 验证: 返回该 notebook 下所有研究会话
- [x] 1.2.4 实现 `GET /v1/notebooks/{id}/research/{rid}` - 获取研究会话详情
  - 包含所有 steps
  - 验证: 返回完整会话数据
- [x] 1.2.5 实现 `DELETE /v1/notebooks/{id}/research/{rid}` - 取消/删除研究会话
  - 验证: 正确删除关联的 steps

### 1.3 Pydantic 模型

- [x] 1.3.1 定义 `ResearchSessionCreate` 请求模型
- [x] 1.3.2 定义 `ResearchSessionResponse` 响应模型
- [x] 1.3.3 定义 `ResearchStepResponse` 响应模型
- [x] 1.3.4 定义 `SearchPlan`, `SearchQuery` 模型
- [x] 1.3.5 定义状态枚举 `ResearchStatus`, `StepType`, `StepStatus`

---

## Phase 2: Agent 逻辑（研究图 + AI 节点）

### 2.1 研究图框架

- [x] 2.1.1 创建 `backend/py/src/crystalith/research/` 模块目录
- [x] 2.1.2 定义 `ResearchGraphState` 数据类
  - 字段: session_id, topic, iteration, search_plan, results, analysis, etc.
- [x] 2.1.3 定义 `ResearchDeps` 依赖类
  - 包含: settings, session, embedder, searcher, etc.

### 2.2 图节点实现

- [x] 2.2.1 实现 `PlanSearches` - 生成搜索计划
  - 使用 AI 生成 SearchPlan
  - 验证: 计划包含 1-5 个查询
- [x] 2.2.2 实现 `WaitForApproval` - 等待用户批准（占位）
- [x] 2.2.3 实现 `ExecuteSearches` - 执行搜索
  - 调用 SearXNGSearcher
  - 验证: 结果正确聚合
- [x] 2.2.4 实现 `AnalyzeResults` - 分析结果
  - 计算覆盖度
  - 决定是否继续
  - 验证: 分析报告格式正确
- [x] 2.2.5 实现 `GenerateReport` - 生成最终报告
  - 验证: 报告包含所有结果摘要

### 2.3 AI Prompt 设计

- [x] 2.3.1 设计搜索计划生成 prompt
  - 输入: topic, iteration, previous_results
  - 输出: SearchPlan JSON
  - 验证: prompt 生成有效计划
- [x] 2.3.2 设计结果分析 prompt
  - 输入: results, topic
  - 输出: analysis + need_more_search
  - 验证: 分析逻辑合理
- [x] 2.3.3 设计报告生成 prompt
  - 验证: 报告结构清晰

### 2.4 简单研究流程（无交互）

- [x] 2.4.1 组装完整研究图（无等待用户节点）
- [x] 2.4.2 实现 `run_research_graph()` 函数
- [x] 2.4.3 集成到 API 端点
  - POST /research/{id}/start 启动后台研究
  - 验证: 完整流程可运行

---

## Phase 3: 人机交互（SSE + 等待用户）

### 3.1 SSE 流式更新

- [x] 3.1.1 实现 `GET /v1/notebooks/{id}/research/{rid}/stream` SSE 端点
  - 验证: curl 可接收 SSE 事件
- [x] 3.1.2 定义 SSE 事件类型和数据格式
  - status, plan_ready, search_progress, analysis, report, done, waiting
- [x] 3.1.3 实现 SSE 事件发送辅助函数 `_sse_event()`
- [x] 3.1.4 在图节点中添加进度回调

### 3.2 等待用户节点

- [x] 3.2.1 实现 `WaitForApproval` 节点
  - 暂停图执行
  - 更新会话状态为 waiting_user
  - 验证: 图在此节点暂停
- [x] 3.2.2 实现会话恢复机制
  - 从数据库恢复状态
  - 继续图执行
  - 验证: 可从 waiting_user 恢复

### 3.3 交互 API 端点

- [x] 3.3.1 实现 `POST /v1/notebooks/{id}/research/{rid}/approve`
  - 批准当前搜索计划
  - 恢复图执行
  - 验证: 正确继续到 ExecuteSearches
- [x] 3.3.2 实现 `POST /v1/notebooks/{id}/research/{rid}/modify`
  - 修改搜索计划
  - 输入: modified_plan
  - 验证: 使用修改后的计划
- [x] 3.3.3 实现 `POST /v1/notebooks/{id}/research/{rid}/skip`
  - 跳过当前轮
  - 验证: 进入下一轮或生成报告
- [x] 3.3.4 实现 `POST /v1/notebooks/{id}/research/{rid}/finish`
  - 提前结束研究
  - 验证: 直接生成报告

### 3.4 并发和状态管理

- [x] 3.4.1 实现研究会话锁机制
  - 防止并发修改
- [x] 3.4.2 实现会话超时处理
  - waiting_user 超时自动取消
- [x] 3.4.3 实现图执行取消机制

---

## Phase 4: 前端实现

### 4.1 API 客户端

- [x] 4.1.1 运行 `pnpm run api:generate` 生成类型
- [x] 4.1.2 API 类型自动生成，无需手动封装

### 4.2 useResearch Hook

- [x] 4.2.1 创建 `frontend/web/src/features/workspace/hooks/useResearch.ts`
- [x] 4.2.2 实现研究会话状态管理
  - sessions, activeSession, currentPlan, results
- [x] 4.2.3 实现 SSE 事件处理
  - onProgress, onPlanReady, onSearchResult, etc.
- [x] 4.2.4 实现交互操作函数
  - startResearch, approve, modify, skip, finish

### 4.3 ResearchCapsule 组件

- [x] 4.3.1 创建 `ResearchCapsule.tsx` 组件
  - 胶囊形式显示：状态图标、主题、进度条、结果计数
  - 验证: 渲染正确，响应点击
- [x] 4.3.2 实现状态指示器
  - 6 种状态的视觉表现（Planning/Waiting/Searching/Analyzing/Completed/Cancelled）
  - "需要您的确认" 使用 `animate-pulse` 吸引注意
- [x] 4.3.3 实现 Hover 和点击交互
  - `cursor-pointer` + `hover:shadow-md transition-shadow duration-200`
  - 点击展开详情面板
- [x] 4.3.4 实现快捷操作菜单 [···]
  - 暂停、取消、设置
- [x] 4.3.5 集成到 SearchResultsQueue
  - 与现有搜索结果卡片共存
  - 在 SourcesPanel 中直接显示 ResearchCapsule 组件

### 4.4 ResearchDetailPanel 组件

- [x] 4.4.1 创建 `ResearchDetailPanel.tsx` 全屏 Overlay 组件
  - 类似 KnowledgeGraphView 的全屏模式
  - 支持 Esc 关闭
- [x] 4.4.2 实现研究进度时间线
  - 横向 Step Indicator (规划→搜索→分析→...)
  - 当前步骤高亮
- [x] 4.4.3 实现 Agent 推理卡片
  - 显示 AI 思考过程
  - [满意]/[不满意]/[重新生成] 反馈按钮
- [x] 4.4.4 实现搜索计划审批 UI
  - 可勾选的查询列表
  - [+ 添加查询] 按钮
- [x] 4.4.5 实现主操作按钮区
  - [开始搜索] 主按钮（高亮）
  - [跳过本轮] / [结束研究] 次级按钮
- [x] 4.4.6 实现已完成轮次折叠面板
  - 默认折叠，可展开查看详情
- [x] 4.4.7 实现快捷操作栏
  - 结果计数、预览、导出

### 4.5 状态反馈与加载

- [x] 4.5.1 实现 Toast 消息系统
  - 操作确认消息（自动消失 3 秒）
  - 使用 react-hot-toast
- [x] 4.5.3 实现进度显示
  - 显示搜索结果数和新增结果数
  - 显示分析覆盖度百分比

### 4.6 搜索模式选择器

- [x] 4.6.1 修改 SourcesPanel 添加模式选择
  - Fast Research / Deep Research 切换
  - 使用下拉菜单样式（已有实现）
- [x] 4.6.2 Deep Research 模式集成
  - 调用 useResearch
  - 创建 ResearchCapsule
  - 启动研究会话并订阅 SSE
- [x] 4.6.3 保存用户偏好
  - localStorage 持久化 (crystalith_search_mode)

---

## Phase 5: 完善和优化

### 5.1 结果处理

- [x] 5.1.1 实现结果去重算法
  - 基于 URL 规范化去重
  - 基于标题相似度去重（85% 阈值）

### 5.2 报告生成

- [x] 5.2.1 实现 Markdown 报告模板
- [x] 5.2.2 定义 ResearchOutput 产出类型
  - report, reference, link, sub_report, raw_result

### 5.3 产出导出功能

- [x] 5.3.1 实现 `POST /research/{rid}/export` API 端点
  - 支持批量导出多个产出
  - 支持不同目标 (source / output)
- [x] 5.3.2 实现导出到来源 (Source)
  - 报告类型：创建 Markdown 来源
  - 链接类型：支持 link/fetch 模式
- [x] 5.3.3 实现导出到输出 (Output)
  - 支持选择输出类型 (structured, bullets, etc.)
  - 保留引用关系
- [x] 5.3.4 创建 `ResearchExportDialog.tsx` 导出选择器组件
  - 分类显示产出（报告、子报告、引用链接）
  - 支持按相关度筛选引用
  - 支持全选/取消选择
- [x] 5.3.5 实现导出目标选择器
  - 来源/输出切换
  - 链接导入模式选择（抓取/仅链接）
  - 提取器选择
- [x] 5.3.6 实现快捷导出按钮
  - "一键导入报告"
  - "导入全部高相关"
  - "自定义选择"

### 5.4 性能优化

- [x] 5.4.1 搜索并发控制
- [ ] 5.4.2 结果缓存 (延后)
- [x] 5.4.3 SSE 心跳机制

### 5.4 错误处理

- [x] 5.4.3 SSE 断连重连
  - 指数退避重连（最多 5 次）
  - 重连状态提示
