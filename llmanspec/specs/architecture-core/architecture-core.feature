# language: zh-CN
# capability: architecture-core
# purpose: 定义 Crystalith v2 前后端基础结构约束：feature-sliced 布局、依赖方向、统一路由入口与出站 HTTP 代理合约。只覆盖结构与边界，不覆盖业务语义。
# scope: apps/, packages/

功能: architecture-core

  @req:r1 @human
  场景: Backend follows feature-sliced layout
    - 后端 MUST 按 feature 切片组织 HTTP 路由，每个业务域 MUST 有清晰的路由入口；跨域共享逻辑 MUST 放置在共享层（shared/ai/rag/db 等），MUST NOT 在多个 feature 内重复实现。

  @req:r2 @human
  场景: Dependency direction is one-way
    - `features` MUST NOT 依赖 web 应用层；`shared` MUST NOT 依赖 `features`。仅类型标注可在 `import type` / 等价边界中例外。

  @req:r3 @human
  场景: Router aggregation is centralized
    - 所有后端路由 MUST 在统一入口（createApp 或等价）聚合挂载，避免多入口隐式依赖链。

  @req:r4 @human
  场景: Frontend workspace is domain-sliced
    - 前端工作区 MUST 按 domain 切片组织，每个 domain MUST 有可独立装配的入口。

  @req:r5 @human
  场景: Frontend app/shared boundaries stay thin
    - `apps/web/src/app` 仅负责入口装配；跨 domain 复用 MUST 放到共享层（apps/web/src/shared 或 features/workspace/shared）。

  @req:r6 @human
  场景: Workspace state uses sliced Zustand stores
    - 复杂工作区状态 MUST 按 slice 组织并通过 selector 访问，避免全局重渲染与循环依赖。

  @req:r_outbound_http @human
  场景: Non-LLM outbound HTTP uses unified proxy-aware client
    - 非 LLM 出站 HTTP（搜索、URL 抓取、网页抽取、同类中间件）MUST 经统一代理感知的出站客户端（outboundFetch 或等价 helper）发出，并读取全局 `proxy_settings`：enabled=false 时 MUST 直连；enabled=true 时 MUST 对未命中 no_proxy 的目标注入 HTTP(S) 代理。socks5_url MAY 保留于配置但本阶段 MUST 忽略。MUST NOT 在这些路径直接调用全局 `fetch` 绕过代理合约。AI SDK / LLM / embedding provider 路径本阶段不受此约束。

  @req:r_outbound_http @human
  场景: no_proxy_skips
    - 当 proxy_settings.enabled=true 且目标命中 no_proxy（如 localhost）时，出站客户端 SHALL 对该目标直连，不注入代理。

  @req:r_outbound_http @human
  场景: https_uses_https_url
    - 当 proxy_settings.enabled=true 且 https_url 非空时，对 HTTPS 目标（如 https://api.firecrawl.dev/v2/scrape）的请求 SHALL 使用该 https_url 作为代理。

  @req:r_taskqueue_retired @human
  场景: Unified TaskQueue HTTP runtime MUST stay retired
    - 系统 MUST NOT 再暴露 /v2/tasks*（含 notebook tasks 列表与 cancel）或恢复已删除的跨域 TaskQueue 作为生成/导入默认底座，除非新产品需求经 SDD 重新提案；对已删除的 /v2/tasks 或 /v2/notebooks/:nid/tasks 的请求 SHALL 返回 404（或等价未挂载）。研究/幻灯片等长任务 MUST 继续使用其域内进度与取消语义（如 SSE），不得假定存在统一 tasks 表轮询 API。
