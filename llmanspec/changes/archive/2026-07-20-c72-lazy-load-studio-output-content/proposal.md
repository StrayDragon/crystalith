---
depends_on:
  - c68-align-openapi-and-pagination
---

## Why

Studio/笔记（outputs）在工作台首页会**一次性加载含正文的列表**，来源多或输出大时首屏卡顿、流量浪费。用户需要：首次只拉列表摘要，点击条目再请求详情/内容。

## What Changes

- **列表 API**：list outputs（及若适用的 studio 笔记列表）默认**不含**大字段（content/markdown/payload body）；仅 id、type、title、status、timestamps、短预览等。
- **详情 API**：已有或补齐 `GET .../outputs/:id`（带 notebook 范围）返回完整内容；前端点击后再 fetch。
- **Web**：`useOutputQueue` / Studio 面板改为列表轻量 + 详情懒加载（缓存已打开项）。
- **BREAKING**：若客户端依赖 list 内嵌全文，须改读详情。

## Capabilities

- `workspace-api-contract`
- `studio-output-types`（或 `output-rendering-and-typing`）
- `workspace-ui-panels`

## Impact

- outputs router list/get 字段策略
- `useOutputQueue`、StudioPanel 渲染路径
- 相关 Vitest；可选 e2e：打开输出不阻塞首屏
