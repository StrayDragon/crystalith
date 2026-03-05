# studio-output-types Specification

## Purpose

定义非 slides 的 Studio 输出类型交互基线（briefing/guide/flashcard/mindmap/quiz/timeline）。该规范以“最小可用交互”约束各类型的前端呈现，保证输出可浏览、可操作与可导出。

## Non-goals

- 不定义统一生成主链路（见 generation-core）
- 不定义具体模板文案

## Requirements

### Requirement: Briefing supports section structure and fold
briefing 输出 MUST 支持章节目录与章节折叠。

#### Scenario: Briefing sections are collapsible
- **WHEN** 用户查看 briefing 输出并操作某一章节
- **THEN** 系统 SHALL 支持章节目录导航与章节折叠/展开

### Requirement: Guide supports checklist and progress cues
guide 输出 MUST 支持可勾选学习路径与进度提示。

#### Scenario: Guide checklist shows progress
- **WHEN** 用户在 guide 中勾选学习步骤
- **THEN** 系统 SHALL 更新进度提示并保持交互可用

### Requirement: Flashcard supports flip and navigation
flashcard 输出 MUST 支持翻面交互与学习进度导航。

#### Scenario: Flashcard flip and navigate
- **WHEN** 用户在 flashcard 上执行翻面与上一张/下一张操作
- **THEN** 系统 SHALL 提供翻面交互并支持进度导航

### Requirement: Mindmap supports read-only exploration
mindmap 输出 MUST 支持只读浏览与节点折叠控制。

#### Scenario: Mindmap nodes can be expanded/collapsed
- **WHEN** 用户浏览 mindmap 并操作某节点
- **THEN** 系统 SHALL 支持只读探索与节点折叠/展开

### Requirement: Quiz supports answering and immediate feedback
quiz 输出 MUST 支持作答、即时反馈与结果汇总。

#### Scenario: Quiz gives feedback
- **WHEN** 用户提交某题答案
- **THEN** 系统 SHALL 提供即时反馈并可查看结果汇总

### Requirement: Timeline supports visual events and detail expansion
timeline 输出 MUST 支持时间轴事件可视化与事件详情展开。

#### Scenario: Timeline details expand
- **WHEN** 用户点击时间轴事件
- **THEN** 系统 SHALL 展示事件详情并保持时间轴可继续浏览

### Requirement: Studio output types are plugin-driven and discoverable
Studio 的工具输出类型集合 MUST 由 `/v1/workspace/tools` 返回的动态列表驱动；客户端 MUST NOT 依赖硬编码枚举来假设某输出类型必然存在。

说明：
- tools 列表的来源可以是 core 内置能力或插件能力
- 在本变更范围内，除 `SLIDES`（暂保留 core 内置）外，其余工具输出类型（FAQ/GUIDE/TIMELINE/MINDMAP/QUIZ/BRIEFING）MUST 由官方插件提供

#### Scenario: Output type options are derived from tools API
- **WHEN** 客户端加载 Studio 的输出类型选择器
- **THEN** 可选项 SHALL 来自 `/v1/workspace/tools` 返回的 tools 列表
- **AND** 当某输出类型插件未安装/未启用时，该类型 SHALL 不作为可选项（或明确展示为不可用）

### Requirement: Missing capabilities are explained to the user
当某输出类型不可用（插件缺失/禁用/加载失败）时，客户端 MUST 能呈现可执行的恢复提示（例如安装/启用对应官方插件），以避免“功能消失但原因不明”。

#### Scenario: UI shows an actionable hint for missing tool
- **WHEN** tools API 返回结构化诊断信息指出某输出类型插件不可用
- **THEN** UI SHALL 显示该能力不可用原因
- **AND** SHALL 显示可执行的恢复步骤（例如需要启用/安装的插件 id）
