## Why
当前后端缺少 LangGraph + Pydantic AI 的基础能力，Studio 功能仍依赖旧的 ChatProvider/手写 JSON。需要建立新的后端架构与接口契约，支持 Studio 工具卡、结构化输出、建议问题、搜索/Deep Research。

## What Changes
- 新增 LangGraph + Pydantic AI 集成基础库（Agent、Deps、StateGraph 基础结构）
- 引入 Studio 相关 API 合同与实现：工具卡、输出生成/列表/详情、建议问题、搜索/Deep Research
- 使用 Pydantic BaseModel 作为结构化输出定义，并启用内置重试机制
- 允许调整现有 API 结构以更贴合 Studio v1

## Impact
- 受影响的规范：新增 `workspace-api`
- 受影响的代码：`backend/py/src/crystalith/agents/`、`backend/py/src/crystalith/api/`、`backend/py/tests`
