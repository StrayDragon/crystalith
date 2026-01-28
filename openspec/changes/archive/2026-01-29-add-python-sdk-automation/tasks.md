## 1. 生成器与版本策略
- [x] 1.1 确认 OpenAPI 生成器选择与配置（包名/项目名/版本覆盖、Python >= 3.10）
- [x] 1.2 AsyncAPI 事件生成方案结论：选型或明确暂缓与原因

## 2. SDK 生成目录与产物规范
- [x] 2.1 确定 SDK 输出目录为 `sdk/client/python` 并标记为生成产物（禁止手改）
- [x] 2.2 约定 README/License 处理方式与生成器模板配置（openapi-python-client config）

## 3. GitHub Actions 自动化
- [x] 3.1 新增手动触发工作流：校验 SDK 版本并发布到 PyPI
- [x] 3.2 发布到 PyPI（优先 Trusted Publishing / OIDC，必要时回退 API token）
- [x] 3.3 增加发布防护与可观测性（失败回滚/告警/日志）

## 4. 文档与验证
- [x] 4.1 SDK 发布与使用说明文档
- [x] 4.2 增加最小验证步骤（生成后可导入、基础调用 smoke test）
