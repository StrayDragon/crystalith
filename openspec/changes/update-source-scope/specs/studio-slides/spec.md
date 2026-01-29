## MODIFIED Requirements
### Requirement: 三阶段流程与状态持久化

系统 **MUST** 以“输入 → 大纲 → Markdown”的三阶段流程生成演示，并由后端持久化各阶段状态与内容。

#### Scenario: 选中来源的生成范围
- **WHEN** 用户在工作区已选择来源并触发演示生成
- **THEN** 后端仅使用选中来源作为生成上下文
- **AND** 未选择来源时使用空上下文且不执行自动检索

#### Scenario: 状态恢复
- **WHEN** 用户重新进入演示流程
- **THEN** 系统加载已保存的大纲/Markdown
- **AND** 不自动重新生成除非用户显式触发

### Requirement: 演示一键生成入口

系统 **MUST** 在 Studio 工具网格的“演示”卡片提供一键生成能力，自动创建/更新演示草稿并串联大纲与 Markdown 生成。

#### Scenario: 一键生成演示

- **WHEN** 用户点击“演示”卡片
- **THEN** 系统为当前 notebook 创建或更新演示草稿并记录解析后的 chunk_ids
- **AND** 未选择来源时记录空范围并继续生成
- **AND** 自动依次触发大纲与 Markdown 生成的 SSE 流
- **AND** 前端展示生成进度并在完成后进入 Markdown 阶段

#### Scenario: 一键生成失败

- **WHEN** 任一生成阶段返回 error
- **THEN** 草稿状态标记为 error 并记录错误信息
- **AND** 前端提供重试入口
