## Why

输出一旦开始被认真排版，就会出现一个现实问题：结构可以自由拼，但太自由就很容易乱。没有组合模板和布局护栏，输出会越来越依赖人工感觉，而不是稳定结构。

## What Changes

- 定义 output composition template，把常见输出结构收成可复用模板。
- 增加 layout guard，限制容易把结构弄坏的组合方式。
- 支持在 briefing、report、slides 这类输出之间共享一部分结构模板，但不强行统一成一种样子。
- 让模板与差异对比、分段锁定和证据钉选自然衔接。

## Capabilities

### New Capabilities
- `output-composition-templates-and-layout-guards`: 定义输出组合模板、布局护栏和结构约束语义。

### Modified Capabilities
- `output-draft-lifecycle-and-regeneration-safety`: 需要支持模板驱动的结构重组。
- `briefing-assembly-board-and-evidence-pinning`: 组装板需要消费模板和护栏。
- `report-section-locking-and-incremental-regeneration`: 锁定与局部重生成需要遵守模板结构。

## Impact

- Backend：会影响模板对象、结构校验和输出装配。
- Frontend：会影响组装界面、模板选择和结构错误提示。
- Dependencies：这条线把 `c475` 和 `c465` 再往前推一步，补的是“好用但别乱”。
