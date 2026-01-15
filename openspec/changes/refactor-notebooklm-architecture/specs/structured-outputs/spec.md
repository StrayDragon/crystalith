## ADDED Requirements

> **背景**：NotebookLM 提供 8 种预设的内容模板，能够将杂乱的信息转化为结构化的知识产品：
> - 常见问题解答 (FAQ)：自动提取文档中的关键问题并提供简明答案
> - 学习指南：将复杂主题分解为逻辑连贯的学习模块
> - 时间轴：识别事件或发展的时序关系，以可视化形式呈现
> - 简报文档：浓缩大量信息为执行摘要，突出关键发现和建议
> - 目录大纲：为长篇内容创建层次分明的导航结构
> - 思维导图：自动提取文档中的核心概念和层级关系，生成树状或网状图
> - 测验试题：基于文档内容生成练习题和测试题
> - 博客文章：将研究资料转化为可读性强的博客内容
>
> 这些结构化输出不仅提高了信息利用率，还显著降低了知识分享的门槛。

### Requirement: 输出类型枚举
系统 MUST支持多种结构化输出类型，覆盖常见的知识整理需求。

#### Scenario: 支持的输出类型
- **WHEN** 用户请求生成输出
- **THEN** 系统支持以下类型：FAQ、GUIDE、TIMELINE、MINDMAP、QUIZ、BRIEFING、PARAGRAPH、BULLETS、STRUCTURED

### Requirement: 输出生成器接口
系统 MUST提供 `OutputGenerator` 抽象接口，支持可扩展的输出类型。

#### Scenario: 生成器接口
- **WHEN** 开发者实现新的输出类型
- **THEN** 系统提供 `OutputGenerator` Protocol，包含 `generate(context: str, prompt: str) -> Output` 方法

### Requirement: FAQ 生成
系统 MUST支持生成常见问题解答，自动提取关键问题并提供简明答案。

#### Scenario: 生成 FAQ
- **WHEN** 用户选择 FAQ 输出类型
- **THEN** 系统从来源中提取 5-10 个关键问题并生成简明答案，输出问答对列表

### Requirement: 学习指南生成
系统 MUST支持生成学习指南，将复杂主题分解为逻辑连贯的学习模块。

#### Scenario: 生成学习指南
- **WHEN** 用户选择 GUIDE 输出类型
- **THEN** 系统将内容分解为学习模块，每个模块包含：学习目标、核心要点、示例、练习建议

### Requirement: 时间轴生成
系统 MUST支持生成时间轴，识别事件的时序关系。

#### Scenario: 生成时间轴
- **WHEN** 用户选择 TIMELINE 输出类型
- **THEN** 系统识别事件的时序关系，输出时间轴数据结构（日期、事件、描述）

### Requirement: 思维导图生成
系统 MUST支持生成思维导图，提取核心概念和层级关系。

#### Scenario: 生成思维导图
- **WHEN** 用户选择 MINDMAP 输出类型
- **THEN** 系统提取核心概念和层级关系，输出树状结构数据（节点、子节点、关联）

### Requirement: 测验生成
系统 MUST支持生成测验题目，帮助用户检验学习效果。

#### Scenario: 生成测验
- **WHEN** 用户选择 QUIZ 输出类型
- **THEN** 系统基于内容生成 5-10 道题目，包含：选择题、判断题、简答题，每题附带答案和解析

### Requirement: 简报生成
系统 MUST支持生成执行简报，浓缩信息为执行摘要。

#### Scenario: 生成简报
- **WHEN** 用户选择 BRIEFING 输出类型
- **THEN** 系统浓缩信息为执行摘要，包含：背景、关键发现、建议、下一步行动

### Requirement: 输出 API
系统 MUST提供输出生成的 REST API。

#### Scenario: 输出 API
- **WHEN** 客户端调用 `POST /v1/notebooks/{id}/outputs` 端点
- **THEN** 系统支持创建输出，请求体包含 type、prompt（可选）、chunk_ids（可选）

#### Scenario: 批量生成
- **WHEN** 客户端请求多种输出类型（types 数组）
- **THEN** 系统并行生成多种输出，返回聚合结果

#### Scenario: 列出输出
- **WHEN** 客户端调用 `GET /v1/notebooks/{id}/outputs` 端点
- **THEN** 系统返回该 Notebook 下的所有输出，按创建时间倒序

### Requirement: 输出模板
系统 MUST支持自定义输出模板，满足个性化需求。

#### Scenario: 自定义模板
- **WHEN** 用户提供自定义提示词
- **THEN** 系统使用自定义提示词生成输出，覆盖默认模板

### Requirement: 输出引用
系统 MUST在输出中包含来源引用。

#### Scenario: 输出引用
- **WHEN** 生成结构化输出
- **THEN** 输出中的每个要点都附带来源引用，支持追溯

---

## 技能要求

### 后端实现技能

1. **uv Python 项目管理** (`uv`)
   - 新增依赖使用 `uv add`
   - 运行测试使用 `uv run pytest`

2. **Python 测试** (`python-testing`)
   - 每种输出类型编写单元测试
   - 使用 pytest fixtures 模拟 LLM 响应
   - 测试覆盖率 > 80%

3. **Ruff 代码质量** (`ruff`)
   - 遵循项目 ruff 配置
   - 提交前运行 `ruff check` 和 `ruff format`

4. **API 设计**
   - 使用 Pydantic 定义请求/响应模型
   - 使用 Enum 定义 OutputType
   - 使用 Protocol 定义 OutputGenerator 接口

### 前端实现技能

1. **UI/UX Pro Max** (`ui-ux-pro-max`)
   - 输出类型选择器使用 Grid 布局
   - 每种类型使用不同图标区分
   - 生成中状态使用骨架屏
   - 输出卡片支持展开/折叠

2. **Vercel React Best Practices** (`vercel-react-best-practices`)
   - 输出内容使用 `useMemo` 缓存渲染
   - 长列表使用虚拟滚动（如 FAQ 列表）

3. **Web Interface Guidelines** (`web-design-guidelines`)
   - 输出类型按钮有清晰的 label
   - 生成状态有进度指示

### 代码组织

**后端**：
```
backend/py/src/crystalith/outputs/
├── __init__.py
├── types.py                    # OutputType 枚举
├── interfaces.py               # OutputGenerator Protocol
├── generators/
│   ├── __init__.py
│   ├── faq.py                  # FAQGenerator
│   ├── guide.py                # GuideGenerator
│   ├── timeline.py             # TimelineGenerator
│   ├── mindmap.py              # MindmapGenerator
│   ├── quiz.py                 # QuizGenerator
│   └── briefing.py             # BriefingGenerator
└── factory.py                  # 生成器工厂
```

**前端**：
```
frontend/web/src/features/workspace/components/outputs/
├── OutputTypeSelector.tsx      # 类型选择器
├── OutputCard.tsx              # 输出卡片
├── FAQOutput.tsx               # FAQ 渲染
├── GuideOutput.tsx             # 学习指南渲染
├── TimelineOutput.tsx          # 时间轴渲染
├── MindmapOutput.tsx           # 思维导图渲染
├── QuizOutput.tsx              # 测验渲染
└── BriefingOutput.tsx          # 简报渲染
```
