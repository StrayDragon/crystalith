## 决策

1. **QA**：保留 **POST** body 驱动的 `/notebooks/:nid/qa/stream`（问题/sourceIds/策略等不宜塞 query）。
2. **Research / Studio progress**：统一 **GET** `.../stream`（资源已存在，仅订阅进度）。
3. **AsyncAPI + OpenAPI** 与实现同发；c69 alias 期间旧路径流式仍可用直至 alias 移除。

## 非目标

- 改变 QA SSE 事件名最小集（chunk|done|error）
- 强制 Studio 前端改回 SSE（若仍用 POST 同步生成，可保留非流式路径，但 stream 端点动词/文档须一致）
