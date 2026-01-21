## ADDED Requirements

### Requirement: Dark Mode Theme

系统必须（SHALL）提供深色模式主题，支持用户在不同光照环境下舒适使用。

#### Scenario: 系统偏好检测

- **WHEN** 用户首次访问系统
- **AND** 未设置主题偏好
- **THEN** 系统检测操作系统主题偏好
- **AND** 自动应用对应主题

#### Scenario: 手动切换主题

- **WHEN** 用户点击主题切换器
- **THEN** 显示 light / dark / system 三个选项
- **AND** 选择后立即应用新主题
- **AND** 偏好被保存到本地存储

#### Scenario: 主题切换无闪烁

- **WHEN** 用户切换主题
- **THEN** 页面平滑过渡到新主题
- **AND** 无白屏或闪烁现象

### Requirement: Theme Accessibility

系统必须（SHALL）确保所有主题满足可访问性标准。

#### Scenario: 颜色对比度

- **WHEN** 任一主题被应用
- **THEN** 文本与背景的对比度至少 4.5:1（WCAG AA）
- **AND** 大文本对比度至少 3:1

#### Scenario: 焦点可见性

- **WHEN** 用户使用键盘导航
- **THEN** 焦点状态在两种主题下均清晰可见
