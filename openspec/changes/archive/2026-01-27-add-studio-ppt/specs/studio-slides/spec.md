## ADDED Requirements

### Requirement: Studio 演示入口

系统 **MUST** 在 Studio 工具网格中提供 `SLIDES` 类型的“演示”入口，并绑定当前 notebook 上下文。

#### Scenario: 展示演示入口
- **WHEN** 工作区加载 Studio 面板
- **THEN** 工具网格中出现“演示”卡片
- **AND** 该卡片的 `output_type` 为 `SLIDES`

#### Scenario: 进入演示流程
- **WHEN** 用户点击“演示”工具
- **THEN** 系统为当前 notebook 打开或创建演示草稿
- **AND** 前端进入演示三阶段界面

### Requirement: 三阶段流程与状态持久化

系统 **MUST** 以“输入 → 大纲 → Markdown”的三阶段流程生成演示，并由后端持久化各阶段状态与内容。

#### Scenario: 选中引用的生成范围
- **WHEN** 用户在工作区已选择引用并触发演示生成
- **THEN** 后端仅使用选中引用作为生成上下文
- **AND** 未选择引用时使用当前 notebook 的检索上下文

#### Scenario: 状态恢复
- **WHEN** 用户重新进入演示流程
- **THEN** 系统加载已保存的大纲/Markdown
- **AND** 不自动重新生成除非用户显式触发

### Requirement: 生成进度与 SSE 事件流

系统 **MUST** 通过 SSE 输出大纲与 Markdown 生成进度，并提供可识别的错误与忙碌状态。

#### Scenario: 生成进度流
- **WHEN** 用户触发大纲或 Markdown 生成
- **THEN** SSE 持续推送 progress/toolcall/done 事件
- **AND** 前端以进度状态展示生成过程

#### Scenario: 忙碌与错误处理
- **WHEN** 同一演示正在生成且用户再次触发
- **THEN** SSE 返回 busy 事件并结束本次连接
- **AND** 失败时返回 error 事件并附带错误信息

### Requirement: 大纲与 Markdown 可编辑

系统 **MUST** 支持用户编辑并保存演示大纲与 Markdown，后端持久化修改并用于后续生成与预览。

#### Scenario: 保存大纲后生成 Markdown
- **WHEN** 用户编辑并保存大纲
- **THEN** 后端保存大纲内容
- **AND** 后续 Markdown 生成基于该大纲执行

#### Scenario: 保存 Markdown 后预览
- **WHEN** 用户编辑并保存 Markdown
- **THEN** 后端保存 Markdown 内容
- **AND** 预览使用最新保存版本

### Requirement: Slidev 预览能力

系统 **MUST** 提供演示预览接口，启动或复用 Slidev CLI 预览进程并返回可访问的预览 URL。

#### Scenario: 启动预览
- **WHEN** 用户点击“预览”
- **THEN** 后端启动或复用 Slidev 预览进程
- **AND** 返回预览 URL 供前端打开

#### Scenario: 预览不可用
- **WHEN** Slidev CLI 不可用或启动失败
- **THEN** 后端返回可识别错误
- **AND** 前端提示用户处理依赖或重试

### Requirement: 演示输出记录

系统 **MUST** 在 Markdown 阶段完成后生成 `SLIDES` 类型输出记录，并在 Studio 历史列表中展示。

#### Scenario: 输出记录创建
- **WHEN** Markdown 生成完成
- **THEN** 系统创建或更新 `SLIDES` 输出记录
- **AND** 输出记录包含最新更新时间与关联草稿信息
