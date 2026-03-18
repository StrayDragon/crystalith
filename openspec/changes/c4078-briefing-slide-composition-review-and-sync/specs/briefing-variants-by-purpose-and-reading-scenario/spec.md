# briefing-variants-by-purpose-and-reading-scenario 规范增量

## ADDED Requirements

### Requirement: Briefing Variants MUST Reuse a Shared Claim-and-evidence Core
系统 MUST 让不同阅读场景下的 briefing variants 复用同一主张、证据和不确定性核心，而不是重新生成彼此脱节的版本。

#### Scenario: 用户切换 briefing 的阅读场景
- **WHEN** 用户在快速回顾、深读核证或继续工作等场景之间切换
- **THEN** 系统 SHALL 复用同一核心内容语义
- **AND** SHALL 仅改变组织方式、密度或呈现顺序

### Requirement: Variant Switching MUST Stay Compatible with Review and Sync Flows
系统 MUST 让 variant 切换与 briefing review、slide sync 等流程兼容，而不是生成只可单独存在的分支视图。

#### Scenario: 某个 briefing 已存在 slide 映射和 review 状态
- **WHEN** 用户切换到另一种 purpose-based variant
- **THEN** 该 variant SHALL 仍能映射回同一 briefing 结构
- **AND** review 和 drift hint SHALL 继续可解释
