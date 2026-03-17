# workspace-ui-core 规范增量

## ADDED Requirements

### Requirement: Workspace supports optional locale switching
在保持默认 `zh-CN` 的前提下，Workspace SHOULD 支持可选的 locale 切换能力（至少 `en-US`），并且偏好 MUST 被持久化。

#### Scenario: 浏览器语言检测
- **WHEN** 用户首次访问且未设置语言偏好
- **THEN** 系统 SHOULD 检测浏览器语言并选择匹配 locale（如有）
- **AND** 若无匹配则回退到 `zh-CN`

#### Scenario: 语言切换入口（可选）
- **WHEN** 语言切换入口启用且用户选择 `en-US`
- **THEN** UI SHALL 立即切换到 `en-US` 文案渲染
- **AND** 用户偏好 MUST 被保存到本地存储

#### Scenario: 缺失翻译回退
- **WHEN** 某个翻译 key 在当前 locale 缺失
- **THEN** UI SHALL 回退到 `zh-CN`（或 fallback locale）的文本
- **AND** 开发模式下 SHOULD 提示缺失翻译

### Requirement: Locale-aware formatting is used for time and numbers
Workspace SHOULD 按当前 locale 格式化日期/时间/数字，并支持相对时间表述的本地化。

#### Scenario: 日期格式随 locale 变化
- **WHEN** UI 需要展示日期/时间
- **THEN** 系统 SHOULD 使用当前 locale 的日期/时间格式

#### Scenario: 相对时间本地化
- **WHEN** UI 需要展示相对时间（如“3 分钟前”）
- **THEN** 系统 SHOULD 使用当前 locale 的表述方式

### Requirement: Touch targets meet a mobile baseline
在移动端窄屏下，Workspace MUST 满足最小触摸交互基线：可点击元素的触摸目标 SHOULD ≥ 44x44 像素，并避免过密导致误触。

#### Scenario: 触摸目标尺寸
- **WHEN** 用户在移动设备上操作 Workspace
- **THEN** 关键操作按钮（上传/发送/生成/切换）SHALL 满足 ≥ 44x44 的触摸目标

### Requirement: Dialogs are usable on mobile viewports
在移动端窄屏下，关键对话框/弹层 SHOULD 采用全屏或近全屏形态展示，并提供明确关闭入口，避免内容被遮挡或无法滚动。

#### Scenario: 对话框全屏化
- **WHEN** 用户在移动端打开对话框
- **THEN** 对话框 SHOULD 以全屏/近全屏形式展示
- **AND** SHALL 提供明确的关闭按钮

### Requirement: Swipe gesture can switch panels (optional)
在移动端窄屏下，Workspace MAY 提供左右滑动手势用于切换主面板，并在交互上提供可理解的拖动反馈。

#### Scenario: 左右滑动切换面板
- **WHEN** 用户在主面板区域左右滑动
- **THEN** UI MAY 切换到相邻面板
- **AND** SHOULD 提供与手势一致的拖动反馈
