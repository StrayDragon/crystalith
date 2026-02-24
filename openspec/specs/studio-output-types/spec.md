# studio-output-types Specification

## Purpose

定义非 slides 的 Studio 输出类型交互基线（briefing/guide/flashcard/mindmap/quiz/timeline）。

## Non-goals

- 不定义统一生成主链路（见 generation-core）
- 不定义具体模板文案

## Requirements

### Requirement: Briefing supports section structure and fold
briefing 输出 MUST 支持章节目录与章节折叠。

### Requirement: Guide supports checklist and progress cues
guide 输出 MUST 支持可勾选学习路径与进度提示。

### Requirement: Flashcard supports flip and navigation
flashcard 输出 MUST 支持翻面交互与学习进度导航。

### Requirement: Mindmap supports read-only exploration
mindmap 输出 MUST 支持只读浏览与节点折叠控制。

### Requirement: Quiz supports answering and immediate feedback
quiz 输出 MUST 支持作答、即时反馈与结果汇总。

### Requirement: Timeline supports visual events and detail expansion
timeline 输出 MUST 支持时间轴事件可视化与事件详情展开。
