## ADDED Requirements

### Requirement: 交互式闪卡翻转

系统 **MUST** 提供可翻转的闪卡界面，支持正面显示问题、背面显示答案。

#### Scenario: 翻转闪卡

- **WHEN** 用户点击闪卡
- **THEN** 卡片以 3D 翻转动画显示另一面
- **AND** 翻转动画时长不超过 300ms

#### Scenario: 键盘翻转

- **WHEN** 用户按下空格键
- **THEN** 当前闪卡翻转

### Requirement: 间隔重复学习系统

系统 **MUST** 实现基于 SM-2 算法的间隔重复系统，追踪每张卡片的复习状态。

#### Scenario: 记录复习结果

- **WHEN** 用户对闪卡评分（Again/Hard/Good/Easy）
- **THEN** 系统根据 SM-2 算法计算下次复习时间
- **AND** 更新卡片的 ease factor 和 interval

#### Scenario: 获取待复习卡片

- **WHEN** 用户进入学习模式
- **THEN** 系统返回所有到期需要复习的卡片
- **AND** 新卡片排在待复习卡片之后

### Requirement: 学习进度统计

系统 **MUST** 显示闪卡学习进度统计信息。

#### Scenario: 显示统计面板

- **WHEN** 用户查看闪卡集
- **THEN** 显示新卡片数量、学习中数量、已掌握数量
- **AND** 显示今日复习进度

### Requirement: 闪卡导出

系统 **MUST** 支持将闪卡导出为多种格式。

#### Scenario: 导出为 Anki 格式

- **WHEN** 用户选择导出为 Anki
- **THEN** 系统生成 .apkg 文件供下载

#### Scenario: 导出为 CSV

- **WHEN** 用户选择导出为 CSV
- **THEN** 系统生成包含问题和答案列的 CSV 文件
