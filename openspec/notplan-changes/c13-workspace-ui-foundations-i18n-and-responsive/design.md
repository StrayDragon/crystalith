## Context

Workspace 顶层体验已经在 `workspace-ui-core` 里定义了移动端单面板 + TabBar 的方向，但目前缺少落地细节（触摸基线、对话框形态、可选手势）以及可维护的文案集中管理与多语言扩展路径。

本 change 将“移动端可用性 + i18n 可扩展性”作为同一条 UI 基线能力推进，避免分散多处重复改动。

## Goals / Non-Goals

- Goals:
  - 移动端（<768px）单面板模式可用，TabBar 可访问且兼容 safe-area
  - 触摸交互基线明确：点击目标尺寸、滚动/hover 策略、对话框移动端形态
  - 文案集中管理：关键路径不再散落硬编码字符串
  - 在默认 `zh-CN` 的前提下，支持可选的 `en-US` 与语言切换入口（偏好持久化 + 浏览器语言检测）
  - locale-aware 的日期/时间/数字/相对时间格式化
- Non-Goals:
  - 不做完整的视觉重设计与全量动效统一
  - 不承诺一次性完成全站字符串提取（以 Workspace 关键路径优先）
  - 不引入模板市场/评分/分享网络等与本 change 无关的产品能力

## Decisions

- Breakpoints:
  - Mobile: `< 768px`
  - Tablet: `768px - 1024px`
- i18n:
  - 采用稳定 message key 作为 SSOT；默认 `zh-CN`
  - `en-US` 与语言切换入口作为可选能力，避免强制增加维护负担
  - 偏好通过本地存储持久化；首次访问可检测浏览器语言

## Risks / Trade-offs

- 字符串提取范围大 → 按关键路径分批推进，先把框架与约束立住
- 多语言维护成本 → 以可选开关与最小 locale 集合开始（zh-CN + en-US）
