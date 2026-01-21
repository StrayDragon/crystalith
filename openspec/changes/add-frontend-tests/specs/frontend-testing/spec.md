## ADDED Requirements

### Requirement: Hook Unit Test Coverage

系统必须（SHALL）为核心前端 hooks 提供单元测试，覆盖率目标 > 80%。

#### Scenario: useNotebooks hook 测试

- **WHEN** 调用 `useNotebooks` hook
- **THEN** 测试覆盖创建、读取、更新、删除笔记本操作
- **AND** 测试 API 错误处理
- **AND** 测试加载状态管理

#### Scenario: useChat hook 测试

- **WHEN** 调用 `useChat` hook
- **THEN** 测试消息发送功能
- **AND** 测试 SSE 流式响应处理
- **AND** 测试引用解析

### Requirement: Component Test Coverage

系统必须（SHALL）为主要 UI 组件提供组件测试，覆盖率目标 > 60%。

#### Scenario: 组件渲染测试

- **WHEN** 组件被挂载
- **THEN** 测试正确渲染预期 UI 元素
- **AND** 测试 props 变化的响应
- **AND** 测试用户交互响应

#### Scenario: 组件可访问性测试

- **WHEN** 组件被渲染
- **THEN** 测试键盘导航支持
- **AND** 测试 ARIA 属性正确性

### Requirement: Test Infrastructure

系统必须（SHALL）提供完善的测试基础设施支持。

#### Scenario: Mock API 响应

- **WHEN** 测试需要模拟 API 调用
- **THEN** 提供统一的 Mock 工具函数
- **AND** 支持成功/失败/超时等场景模拟

#### Scenario: 测试覆盖率报告

- **WHEN** 运行测试套件
- **THEN** 生成覆盖率报告
- **AND** 报告包含行覆盖、分支覆盖、函数覆盖指标
