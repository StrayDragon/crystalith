## Why

当前后端各 feature 的 service 直接通过模块级别导入获取依赖（db session、AI provider、vector store 等），缺少统一的依赖注入机制。这导致单元测试中 mock 困难，模块间耦合度较高，且更换实现（如切换 vector store provider）需要修改多处代码。引入依赖注入容器可提高可测试性和模块解耦度。

## What Changes

- 利用 FastAPI 内建的 Depends 系统建立统一的依赖注入规范
- 将 AI provider、embedding provider、vector store、db session 等注册为可注入依赖
- 各 feature service 通过依赖注入获取所需组件
- 简化测试中的 mock 流程（通过 dependency_overrides）

## Impact

- 受影响的规范：`backend-module-structure`（MODIFIED）
- 受影响的系统：
  - 后端 service 层的依赖获取方式
  - 测试 fixtures 和 mock 方式
  - FastAPI 路由的依赖声明
