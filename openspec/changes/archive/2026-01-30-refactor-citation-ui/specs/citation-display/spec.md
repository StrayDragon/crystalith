# Spec: citation-display

## Overview

引用展示功能规范，定义引用在不同场景下的展示方式和交互行为。

## ADDED Requirements

### Requirement: CitationPopover 组件

系统 SHALL 提供通用的引用列表悬浮展示组件 CitationPopover。

#### Scenario: 打开引用悬浮窗

**Given** 用户在 ChatPanel 或 StudioOutputViewer 中
**When** 用户点击"查看引用"或"查看全部"按钮
**Then** 系统 SHALL 显示 CitationPopover 悬浮窗
**And** 悬浮窗 SHALL 显示在按钮附近
**And** 悬浮窗 SHALL 包含所有引用的列表

#### Scenario: 关闭引用悬浮窗

**Given** CitationPopover 已打开
**When** 用户点击关闭按钮或悬浮窗外部
**Then** 系统 SHALL 关闭 CitationPopover

#### Scenario: 从悬浮窗跳转到引用

**Given** CitationPopover 已打开并显示引用列表
**When** 用户点击某个引用项
**Then** 系统 SHALL 触发跳转到对应来源的回调
**And** CitationPopover SHALL 保持打开（用户可继续查看其他引用）

#### Scenario: 悬浮窗定位边界处理

**Given** 触发按钮靠近视口边缘
**When** 打开 CitationPopover
**Then** 悬浮窗 SHALL 自动调整位置避免超出视口
**And** 系统 SHALL 优先显示在按钮下方，空间不足时显示在上方

### Requirement: ChatPanel 引用查看入口

系统 SHALL 在 ChatPanel 的助手消息中提供查看引用的入口。

#### Scenario: 显示查看引用按钮

**Given** 助手消息包含引用
**When** 消息渲染完成
**Then** 系统 SHALL 在引用标记旁显示"查看引用"按钮
**And** 按钮 SHALL 显示引用数量（如"查看引用 (3)"）

#### Scenario: 无引用时不显示按钮

**Given** 助手消息不包含引用
**When** 消息渲染完成
**Then** 系统 SHALL NOT 显示"查看引用"按钮

### Requirement: StudioOutputViewer 引用查看入口

系统 SHALL 在 StudioOutputViewer 的引用区域提供查看全部引用的入口。

#### Scenario: 显示查看全部按钮

**Given** 输出内容包含引用
**When** StudioOutputViewer 打开
**Then** 系统 SHALL 在引用区域显示"查看全部"按钮
**And** 系统 SHALL 保留现有的引用标记 [1][2][3] 展示

#### Scenario: 点击查看全部

**Given** StudioOutputViewer 已打开且有引用
**When** 用户点击"查看全部"按钮
**Then** 系统 SHALL 打开 CitationPopover 显示所有引用

## MODIFIED Requirements

### Requirement: 深度研究并发控制

系统 SHALL 修改深度研究创建逻辑，防止并发创建多个研究。

#### Scenario: 阻止并发创建研究

**Given** 已有一个状态为 `searching`、`analyzing` 或 `waiting_user` 的研究会话
**When** 用户尝试创建新的深度研究
**Then** 系统 SHALL 显示错误提示"已有研究任务正在进行中，请等待完成后再创建新研究"
**And** 系统 SHALL NOT 创建新的研究会话

#### Scenario: 允许在已完成研究后创建新研究

**Given** 所有现有研究会话状态为 `completed`、`cancelled` 或 `planning`
**When** 用户尝试创建新的深度研究
**Then** 系统 SHALL 正常创建新的研究会话

#### Scenario: 加载中状态阻止创建

**Given** `research.isLoading` 为 true
**When** 用户尝试创建新的深度研究
**Then** 系统 SHALL 显示错误提示"请稍候，操作正在进行中"
**And** 系统 SHALL NOT 创建新的研究会话

## Cross-References

- 相关组件：`CitationMark`（保持现有悬停 tooltip 功能）
- 相关组件：`CitationList`（左侧面板的引用列表，不在此规范范围内）
- 相关组件：`CitationActions`（批量操作栏，保持现有功能）
