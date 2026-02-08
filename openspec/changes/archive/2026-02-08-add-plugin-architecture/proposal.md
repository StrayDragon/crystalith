## Why

当前系统的 AI provider、document parser、web extractor 和 output type 都是硬编码在代码中的。添加新的 provider 或 output 类型需要修改核心代码。引入插件架构可让用户和开发者通过标准接口扩展系统能力，降低核心代码的变更频率，支持社区贡献。

## What Changes

- 定义插件接口规范（AI Provider Plugin、Parser Plugin、Output Type Plugin）
- 实现插件发现和加载机制（基于 Python entry_points）
- 添加插件注册表和生命周期管理
- 支持通过配置文件启用/禁用插件
- 提供插件开发文档和模板

## Impact

- 受影响的规范：`ai-provider-config`（MODIFIED），`backend-module-structure`（MODIFIED）
- 受影响的系统：
  - 后端 provider 工厂方法
  - 后端 parser 注册
  - 配置文件 schema
