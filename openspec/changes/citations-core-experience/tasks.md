## 1. API：citation 一致性与上下文查询

- [ ] 1.1 定义 citation context 端点与响应结构（OpenAPI + 实现）。
- [ ] 1.2 为 QA/messages/outputs 的 citations 增加 contract tests，确保字段一致与 1-based 语义不漂移。

## 2. API：带引用导出

- [ ] 2.1 增加 QA 导出端点（Markdown/JSON），包含 answer + citations + source 元信息。
- [ ] 2.2 增加 Outputs 导出端点（Markdown/JSON），包含结构化内容 + citations 清单。

## 3. Frontend：统一 citation 组件

- [ ] 3.1 抽出可复用的 citation 展示组件（含 hover、click、drawer/detail）。
- [ ] 3.2 集成 citation context 拉取与“定位到来源/复查上下文”交互。
- [ ] 3.3 增加全局导出入口（命令面板/全局工具栏），并在 Chat/Outputs 提供可选快捷入口。

## 4. Docs

- [ ] 4.1 增加“证据链使用指南”：如何复查、如何导出、常见失败态说明。

## 5. Verification

- [ ] 5.1 `cd backend/py && just test`
- [ ] 5.2 `cd frontend/web && pnpm test`
- [ ] 5.3 `just api-sync`（如 OpenAPI 变更）
