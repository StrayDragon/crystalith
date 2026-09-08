# Design — add-extractor-arxiv

## D1 网络传输与代理（ctx.fetch 注入）

外部插件不应该各自处理代理。宿主在 factory 时注入 `ctx.fetch` =
`outboundFetch`（`shared/net/outbound-fetch.ts`）——自动继承全局代理 SSOT
（`config/app.yaml` proxy_settings + `CL_PROXY_ENABLED/HTTP_URL/HTTPS_URL`
overlay + no_proxy）。插件代码里 **MUST NOT 使用全局 fetch**。

- 对 `export.arxiv.org` 的请求天然获得与 URL 导入/网页搜索一致的代理行为
- `types.ts` 的 `CrystalithPluginContext` 增加必填 `fetch` 字段——ctx 是
  宿主侧服务注入面，不在 r7 枚举的插件字段内，不触发 specs landing
- 网络不通时的用户路径：配 `CL_PROXY_HTTP(S)_URL` 或 `HTTPS_PROXY` 前缀
  （Bun fetch proxy 遵循标准代理变量语义的场景以宿主配置为准）

## D2 Atom 解析（零依赖）

export.arxiv.org 的 Atom 响应结构多年稳定（单 entry：title/summary/author*/
published/updated/arxiv:primary_category/link[@type=application/pdf]）。
v1 用定向正则 + 实体解码解析，不引入 XML 依赖；若未来字段需求复杂化，
再考虑 `fast-xml-parser`（纯 JS，符合插件依赖约束）。

## D3 host 门控与链路位置（诚实约束）

extractor 编排按 priority 顺序尝试；`isAvailable` 接口拿不到 URL，因此
host 门控只能发生在 `extract` 内（非 arxiv URL → 空内容 → 编排层降级）。
由此的默认链路位置：外部插件注册在内置之后 → **默认排在链尾**，arxiv URL
通常先被 readability 命中。想让 arxiv 优先：

```yaml
plugins:
  load_order: ['extractor-arxiv'] # 实例化顺序提前 → 默认 fallback 顺序提前
```

或单次摄入用 `preferredExtractor`（r113 既有能力）。「URL 感知优先级」是
kind 契约的潜在扩展（isAvailable 增加 url 参数），留待有第二个 host 门控
插件时再评估，本期不做。

## D4 本地快速调试

- **免启服运行器**：`bun packages/plugin-extractor-arxiv/scripts/try.ts
<arxiv-url>…`——直接 factory + extract 打印结果；网络走宿主同款
  outboundFetch（代理语义与 server 一致）
- **server 内联调**：workspace symlink（`bun install` 后
  `node_modules/@crystalith-plugin/extractor-arxiv` 命中 discovery）→
  编辑插件后按 r11 语义重启 server 生效（plugins 本就是 restart-loaded）
- 从仓库根目录运行 try.ts（app.yaml/`.env` 的相对路径解析依赖 CWD）

## 非目标

- 不改 wire；不做 PDF 全文（parser 域）；不做 URL 感知优先级扩展
