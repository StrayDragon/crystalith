## ADDED Requirements

### Requirement: 共享骨架屏组件
系统 MUST 在 `src/shared/` 中提供统一的骨架屏组件库（SkeletonLine、SkeletonCard、SkeletonList），供所有 feature 复用。

#### Scenario: feature 使用共享骨架屏
- **WHEN** 任一 feature 需要展示加载状态
- **THEN** 使用 `src/shared/` 中的骨架屏组件
- **AND** 不在 feature 内部维护独立的骨架屏实现
