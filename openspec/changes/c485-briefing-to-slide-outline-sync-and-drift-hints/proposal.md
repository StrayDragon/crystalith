## Why

Briefing 和 Slides 经常是一前一后两种表达。问题是它们一旦各自改起来，很快就会漂。没有轻量同步和漂移提示，用户只能靠记忆去对齐两边内容。

## What Changes

- 定义 briefing to slide outline sync，把 briefing 结构和 slide 纲要建立可追踪映射。
- 增加 drift hint，当一边结构变动后提醒另一边可能已经不同步。
- 区分自动可同步部分和只做提示不自动改写的部分。
- 让漂移提示进入 briefing 和 slides 两边，而不是只在某一端可见。

## Capabilities

### New Capabilities
- `briefing-to-slide-outline-sync-and-drift-hints`: 定义 briefing 与 slides 纲要同步和漂移提示语义。

### Modified Capabilities
- `studio-slides-workflow`: 需要支持纲要映射与漂移提示。
- `briefing-assembly-board-and-evidence-pinning`: 需要暴露可同步的结构边界。
- `output-diff-compare-and-version-review`: 漂移提示需要可比较地展示。

## Impact

- Backend：会影响结构映射、漂移检测和同步提示接口。
- Frontend：会影响 briefing 编辑、slides 编辑和提示入口。
- Dependencies：这条线衔接 `c475` 和 `c450`，补多输出之间的结构协同。
