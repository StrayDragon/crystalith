## ADDED Requirements

### Requirement: 交互式闪卡翻转

系统 **MUST** 提供可翻转的闪卡界面，支持正面显示问题、背面显示答案。

#### Scenario: 点击翻转

- **WHEN** 用户点击闪卡
- **THEN** 卡片切换到另一面
- **AND** 正面显示问题，背面显示答案

#### Scenario: 键盘翻转

- **WHEN** 用户按下空格键
- **THEN** 当前闪卡翻转

### Requirement: 学习导航与进度

系统 **MUST** 提供闪卡浏览导航与进度提示。

#### Scenario: 切换卡片

- **WHEN** 用户点击上一张/下一张或使用左右方向键
- **THEN** 切换到对应卡片

#### Scenario: 进度显示

- **WHEN** 用户浏览闪卡
- **THEN** 显示当前张数与总张数
