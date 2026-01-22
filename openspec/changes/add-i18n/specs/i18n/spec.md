## ADDED Requirements

### Requirement: Multi-Language Support

系统必须（SHALL）支持多语言界面，初期支持中文和英文。

#### Scenario: 语言切换

- **WHEN** 用户点击语言切换器
- **THEN** 显示可用语言列表（zh-CN, en-US）
- **AND** 选择后界面立即切换到新语言
- **AND** 无需刷新页面

#### Scenario: 语言偏好持久化

- **WHEN** 用户选择语言
- **THEN** 偏好被保存到本地存储
- **AND** 下次访问自动使用保存的语言

#### Scenario: 浏览器语言检测

- **WHEN** 用户首次访问
- **AND** 未设置语言偏好
- **THEN** 系统检测浏览器语言设置
- **AND** 自动选择匹配的语言（如有）

### Requirement: String Localization

系统必须（SHALL）将所有用户可见字符串外置为翻译文件。

#### Scenario: 完整翻译覆盖

- **WHEN** 切换到任一支持的语言
- **THEN** 所有 UI 文本显示为该语言
- **AND** 无未翻译的字符串显示

#### Scenario: 缺失翻译降级

- **WHEN** 某个翻译键缺少特定语言的翻译
- **THEN** 显示 fallback 语言的文本
- **AND** 开发模式下显示警告

### Requirement: Format Localization

系统必须（SHALL）根据语言区域设置格式化日期、时间和数字。

#### Scenario: 日期格式本地化

- **WHEN** 显示日期信息
- **THEN** 使用当前语言区域的日期格式
- **AND** zh-CN 使用 YYYY年MM月DD日
- **AND** en-US 使用 MM/DD/YYYY

#### Scenario: 相对时间本地化

- **WHEN** 显示相对时间（如"3分钟前"）
- **THEN** 使用当前语言的表述方式
