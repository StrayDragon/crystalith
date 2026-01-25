## 1. 后端分析模块

- [x] 1.1 创建 `analysis/` 模块目录结构
- [x] 1.2 实现 `CorrelationAnalyzer` 类 (`correlation.py`)
- [x] 1.3 实现 `TopicClusterer` 类 (`clustering.py`)
- [x] 1.4 实现 `ContradictionDetector` 类 (`contradiction.py`)

## 2. 关联检测

- [x] 2.1 基于向量相似度计算来源关联
- [x] 2.2 提取共享实体/概念（通过向量相似度）
- [x] 2.3 生成关联报告（API 返回 relations 列表）

## 3. 主题聚类

- [x] 3.1 实现基于向量的主题聚类算法
- [x] 3.2 为每个聚类生成主题标签（关键词提取）
- [x] 3.3 可视化主题分布（前端 TopicCard 组件）

## 4. 矛盾检测

- [x] 4.1 实现语义矛盾检测逻辑
- [x] 4.2 调用 AI 验证潜在矛盾
- [x] 4.3 生成矛盾点报告（API 返回 contradictions 列表）

## 5. 前端展示

- [x] 5.1 创建 `AnalysisPanel.tsx` 组件
- [x] 5.2 实现关联可视化（列表形式，带相似度进度条）
- [x] 5.3 实现主题聚类可视化（彩色卡片 + 关键词）
- [x] 5.4 实现矛盾点高亮展示（红色标记）

## 6. API 端点

- [x] 6.1 创建统一的 `/analysis` 端点（返回 topics, relations, contradictions）

## 7. 集成

- [x] 7.1 更新 `useAnalysis` hook 使用正确的 API 类型
- [x] 7.2 在 WorkspaceLayout 中集成 AnalysisPanel
- [x] 7.3 添加来源/分析视图切换按钮
