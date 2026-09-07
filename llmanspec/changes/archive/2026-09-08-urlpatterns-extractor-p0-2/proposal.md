---
depends_on: []
branch: sdd/urlpatterns-extractor-p0-2
base_sha: 88e420481b9cf3a0ac9d9e0628e5355f8266cdb3
checkpointed: true
checkpoint_sha: 88e420481b9cf3a0ac9d9e0628e5355f8266cdb3
---

# URL 导入按粘贴链接自动勾选排序提取器（urlPatterns 元数据透出）

## Why

- arxiv 提取器的 URL 门控正则是**插件私有实现**（`plugin-extractor-arxiv` 内 `ARXIV_ABS_URL`，
  靠返回空内容 fall-through 到下一个提取器），前端无法感知「哪些提取器匹配当前粘贴的 URL」。
- `AddSourceFromUrlDialog` 只有 URL + link/fetch 两档，无任何提取器选择；每笔记本的提取器策略
  在独立的 `ExtractorPolicyDialog` 里，入口割裂——用户粘贴 arxiv 链接时不知道系统能专业抽取。
- 目标体验（用户已确认方向，交互细节可能在 propose 阶段再调）：
  粘贴 URL 后自动按 URL 正则匹配 → 命中的提取器自动勾选并置顶排序 → 用户可手动增删调整；
  无命中时保持现状默认链不变。

## What Changes

- `CrystalithPlugin` 接口（extractor kind）增加**可选** `urlPatterns` 元数据：
  正则以字符串源（`string[]`，regex source）声明以便序列化过 wire；无声明 = 通用提取器不参与匹配。
- `extractor-arxiv` 声明其 abs URL 正则；builtin readability/jina/firecrawl 为通用回退，不声明。
- `GET /v2/notebooks/:nid/extractors` 元数据响应透出 `urlPatterns`。
- `AddSourceFromUrlDialog`（fetch 模式）：输入 / 粘贴时对已有元数据做本地正则匹配，
  自动勾选 + 置顶；用户可调整；提交走已有的 from-url 显式 `extractor` 参数链路。
- 不改提取器执行链的 fall-through 语义（urlPatterns 仅用于 UI 预选提示，不收窄执行行为）。

## Capabilities

- `web-extractor-plugins`（扩展）：插件可声明 urlPatterns 元数据。
- `web-url-import-extractor-hints`（新）：URL 导入对话框的自动勾选 / 排序交互。

## Impact

- `apps/server/src/plugins/types.ts`（接口可选字段）
- `packages/plugin-extractor-arxiv`（声明 urlPatterns）
- `apps/server/src/features/sources/router.ts`（extractors 元数据端点）
- `apps/web/src/features/workspace/layout/overlays/AddSourceFromUrlDialog.tsx`（匹配 + 勾选 UI）
- 交互设计细节（置顶样式、勾选粒度、与 ExtractorPolicyDialog 的关系）在正式化时定稿
