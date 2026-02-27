## Why

- 当前 Workspace 的 Sources 面板在前端层面只允许上传 `.txt/.md/.markdown`，会把 `.pdf` 直接判定为“不支持”。但后端内置 parser 已支持 `application/pdf`，且 SDK 文档示例也以上传 PDF 为主流入口。这个不一致会让用户在最关键的“导入来源”第一步就卡住，降低对产品的信任并增加排障成本。

## What Changes

- 前端 Sources 上传入口（点击选择 + 拖拽）支持 `.pdf`（`application/pdf`），并保证：
  - `accept` 与前端预过滤规则一致；
  - “不支持文件类型”的提示文案与实际支持集一致；
  - 现有 `.txt/.md/.markdown` 行为保持不变。
- 更新前端单测覆盖：PDF 应被视为支持类型；同时保留至少一个明确的不支持类型样例（如 `.docx`）以验证过滤逻辑。
- （可选）更新后端 ingestion 失败的恢复提示文案，使其不再暗示“只能转换为 txt/markdown”作为唯一出路（在 PDF 成为官方支持格式后）。

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `workspace-ui-panels`: Sources 上传的“可选文件类型 + 过滤逻辑 + 用户提示”必须与后端内置解析能力保持一致，且至少包含 PDF。

## Impact

- Frontend: 需要修改 Sources 面板上传组件的 `accept`、文件类型过滤与提示文案，并更新对应测试用例。
- Backend: 可能需要调整部分失败态 `recovery_hint` 文案以避免误导（不涉及 API shape 变更）。
- Docs: 可补充/修正“支持的来源文件类型”说明，避免与 UI 或 SDK 示例漂移。
