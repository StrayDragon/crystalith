# workspace-ui-sources Specification

## Purpose

定义 Sources 面板交互契约：上传、搜索队列、来源选择、筛选排序、详情查看与批量动作。

## Non-goals

- 不定义后端 ingestion 算法细节
- 不定义跨域输出渲染

## Requirements

### Requirement: Sources panel composition is stable
Sources 面板 MUST 保持固定核心区域：上传、搜索、队列、来源列表与详情入口。

### Requirement: Upload pre-filtering is enforced in UI
前端上传入口 MUST 过滤不支持格式，混合上传时忽略不支持项并提示。

### Requirement: Search results are queue-based and concurrent
多次搜索 MUST 形成独立队列项并行显示状态，不得互相覆盖。

### Requirement: Add-to-source supports link and fetch modes
从搜索结果添加来源 MUST 支持 `link` 与 `fetch` 两种模式，并支持批量进度反馈。

### Requirement: Source selection and status gating are explicit
仅 `ready` 来源可选；`processing/failed` MUST 明确禁用原因，并支持可用的恢复动作。

### Requirement: Sorting and tag filtering align with backend query
排序与标签筛选控件 MUST 与后端 list 参数语义一致。
