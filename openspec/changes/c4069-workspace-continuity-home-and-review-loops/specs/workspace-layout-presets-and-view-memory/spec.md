# workspace-layout-presets-and-view-memory 规范增量

## ADDED Requirements

### Requirement: View Memory and Return Points MUST Share a Stable Context Model
系统 MUST 让 view memory 与 return points 共享稳定的恢复上下文模型，而不是分别维护两套相似状态。

#### Scenario: 用户中断后回到上次现场
- **WHEN** 用户通过首页、命令入口或 recent continue-work 入口恢复现场
- **THEN** 系统 SHALL 恢复最小必要的布局、焦点对象与落点信息
- **AND** SHALL 避免要求用户重新寻找原始对象

### Requirement: Focus Mode MUST Be Temporary and Reversible
系统 MUST 将 focus mode 表达为临时工作态，而不是直接改写长期布局偏好。

#### Scenario: 用户短暂进入专注模式
- **WHEN** 用户围绕某个 notebook、run、output 或 source 进入 focus mode
- **THEN** 系统 SHALL 临时降噪并收窄界面
- **AND** 退出后 SHALL 恢复原本布局与非临时偏好

### Requirement: Deep Links MUST Resolve Consistently Across Entry Points
系统 MUST 让 URL、命令动作、首页卡片与搜索落点遵守同一套深链定位规则。

#### Scenario: 从不同入口跳到同一个对象
- **WHEN** 用户从 URL 或首页卡片打开同一 source/output/block
- **THEN** 系统 SHALL 落到同一对象定位规则
- **AND** SHALL 尽可能保持一致的周边上下文恢复
