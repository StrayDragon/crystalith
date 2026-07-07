<!--
AUTO-GENERATED. DO NOT EDIT BY HAND.
Generator: backend/py/scripts/gen_docs.py (run: just gen-docs)
Source: config/app.schema.gen.json
-->
# Configuration Schema Reference (Generated)

SSOT: `config/app.schema.gen.json`

Regeneration:
- Config schema: `cd backend/py && just config-schema`
- Docs reference: `just gen-docs`

## Key paths (max depth: 5)

| Path | Type | Description |
| --- | --- | --- |
| `ai` | `object` | AI provider runtime settings. |
| `ai.max_retries` | `integer` | Maximum retries for retryable provider errors |
| `ai.timeout` | `integer` | Provider request timeout in seconds |
| `app` | `object` | Application settings. |
| `app.auth` | `object` | Optional API authentication settings for self-host deployments. |
| `app.auth.api_key` | `anyOf` | Shared API key used for 'Authorization: Bearer <token>'. Prefer injecting via {{ env.* }} / {{ secret.* }}. |
| `app.auth.enabled` | `boolean` | If true, require API key authentication for /v1 endpoints. |
| `app.cors` | `object` | CORS middleware settings for the API server. |
| `app.cors.allow_credentials` | `boolean` | Whether to allow cookies/credentials. |
| `app.cors.allow_headers` | `array` | Allowed headers. |
| `app.cors.allow_methods` | `array` | Allowed methods. |
| `app.cors.allow_origins` | `array` | Allowed origins (empty list disables CORS middleware). |
| `app.features` | `object` | Application feature flags. |
| `app.features.chat_prompt_presets_enabled` | `boolean` | Enable /prompt:* directives in QA. |
| `app.features.workspace_frontend_bundles_enabled` | `boolean` | If true, expose frontend bundle descriptors for workspace tools/outputs (enables interactive renderers in the web UI). Set false to force fallback rendering. |
| `app.http_guardrails` | `object` | HTTP runtime guardrails for non-local exposure. |
| `app.http_guardrails.mode` | `string` | Guardrails mode: auto enables only when the server is bound to a non-loopback host; enabled/disabled force override. |
| `app.http_guardrails.rate_limit` | `object` | HTTP rate limiting settings (best-effort, single-process baseline). |
| `app.http_guardrails.rate_limit.enabled` | `boolean` | If true, enable basic HTTP rate limiting for core /v1 endpoints. |
| `app.http_guardrails.rate_limit.key` | `string` | Rate limit identity strategy (default: direct client IP; do not trust proxy headers). |
| `app.http_guardrails.rate_limit.max_requests` | `integer` | Maximum requests per window per key (0 disables). |
| `app.http_guardrails.rate_limit.window_s` | `integer` | Fixed window size in seconds. |
| `app.http_guardrails.upload_max_bytes` | `integer` | Maximum upload size in bytes when guardrails are enabled (0 disables). |
| `app.name` | `string` |  |
| `app.openapi_path` | `string` |  |
| `app.openapi_ui_path` | `string` |  |
| `app.startup` | `object` | Startup behaviors. |
| `app.startup.auto_db_init` | `boolean` | If true, automatically runs DB migrations on startup. Recommended for local/dev; for production, prefer controlled migrations. |
| `app.startup.cleanup_failed_sources` | `boolean` | If true, delete sources with status='failed' on backend startup. WARNING: this removes DB rows and may orphan related files/vectors. |
| `cache` | `object` | Cache settings. |
| `cache.max_size` | `integer` | Maximum number of cached keys for in-memory cache |
| `cache.provider` | `string` |  |
| `cache.redis_url` | `anyOf` | Redis connection URL when provider=redis |
| `cache.redis_url_candidates` | `array` | Optional candidate Redis URLs. When provider=auto, the loader may probe and select the first reachable Redis and upgrade cache.provider to redis. When none are reachable, it falls back to memory. |
| `cache.ttl` | `integer` | Default cache TTL in seconds (0 disables TTL) |
| `chat` | `object` | Chat settings. Use models.defaults.chat to specify the default chat model. This section only contains chat-specific options. |
| `concurrency` | `object` | Stage-level concurrency guardrails for key I/O phases. |
| `concurrency.embedding` | `integer` | Max concurrent embedding calls (0 disables limiter). Applies to retrieval/QA/refine embedding stages. |
| `concurrency.llm_generate` | `integer` | Max concurrent LLM generation calls (0 disables limiter). |
| `concurrency.vector_search` | `integer` | Max concurrent vector search calls (0 disables limiter). |
| `context_window` | `object` | Context window management settings. |
| `context_window.compression_strategy` | `string` |  |
| `context_window.max_tokens` | `integer` |  |
| `context_window.priority` | `array` |  |
| `context_window.window_size` | `integer` |  |
| `database` | `object` | Database settings. |
| `database.url` | `string` |  |
| `database.url_candidates` | `array` | Optional candidate database URLs. When set, the loader may probe and select the first reachable URL for the active runtime environment (e.g. compose service name vs host dev ports). |
| `embedding` | `object` | Embedding settings. Use models.defaults.embedding to specify the default embedding model. This section only contains embedding-specific options. |
| `embedding.batch_size` | `integer` | Batch size for embedding requests |
| `embedding.chunk_size` | `integer` | Default chunk size for embedding |
| `models` | `object` | Multi-model configuration settings. All models must be defined in `available` list with unique IDs. Use `defaults` to specify which model to use for each role. Example: models: defaults: chat: "gpt-5.2" embedding: "bge-m3-local" available: - id: "gpt-5.2" provider: "openai" model: "gpt-5.2" roles: [chat, edit] |
| `models.available` | `array` |  |
| `models.defaults` | `object` | Default model selections. |
| `models.defaults.autocomplete` | `anyOf` | Default model ID for autocomplete |
| `models.defaults.chat` | `anyOf` | Default model ID for chat/generation |
| `models.defaults.edit` | `anyOf` | Default model ID for code editing |
| `models.defaults.embedding` | `anyOf` | Default model ID for embeddings |
| `name` | `string` | Configuration name |
| `optional_services` | `object` | Optional dependency service contracts. |
| `optional_services.chroma` | `object` | Runtime contract for one optional dependency service. |
| `optional_services.chroma.degrade_policy` | `string` | Degrade policy when dependency is unavailable |
| `optional_services.chroma.enabled` | `boolean` | Whether this optional service is enabled |
| `optional_services.chroma.endpoint` | `anyOf` | Service endpoint/base URL |
| `optional_services.chroma.endpoint_candidates` | `array` | Optional candidate endpoints for this service. Used for probing/selection across environments. |
| `optional_services.chroma.probe` | `object` | Probe settings for an optional dependency service. |
| `optional_services.chroma.probe.enabled` | `boolean` | Whether periodic probing is enabled |
| `optional_services.chroma.probe.interval_s` | `number` | Probe interval in seconds |
| `optional_services.chroma.probe.path` | `anyOf` | Optional HTTP probe path |
| `optional_services.chroma.probe.timeout_s` | `number` | Probe timeout in seconds |
| `optional_services.chroma.timeout_s` | `number` | Connection timeout in seconds |
| `optional_services.redis` | `object` | Runtime contract for one optional dependency service. |
| `optional_services.redis.degrade_policy` | `string` | Degrade policy when dependency is unavailable |
| `optional_services.redis.enabled` | `boolean` | Whether this optional service is enabled |
| `optional_services.redis.endpoint` | `anyOf` | Service endpoint/base URL |
| `optional_services.redis.endpoint_candidates` | `array` | Optional candidate endpoints for this service. Used for probing/selection across environments. |
| `optional_services.redis.probe` | `object` | Probe settings for an optional dependency service. |
| `optional_services.redis.probe.enabled` | `boolean` | Whether periodic probing is enabled |
| `optional_services.redis.probe.interval_s` | `number` | Probe interval in seconds |
| `optional_services.redis.probe.path` | `anyOf` | Optional HTTP probe path |
| `optional_services.redis.probe.timeout_s` | `number` | Probe timeout in seconds |
| `optional_services.redis.timeout_s` | `number` | Connection timeout in seconds |
| `optional_services.searxng` | `object` | Runtime contract for one optional dependency service. |
| `optional_services.searxng.degrade_policy` | `string` | Degrade policy when dependency is unavailable |
| `optional_services.searxng.enabled` | `boolean` | Whether this optional service is enabled |
| `optional_services.searxng.endpoint` | `anyOf` | Service endpoint/base URL |
| `optional_services.searxng.endpoint_candidates` | `array` | Optional candidate endpoints for this service. Used for probing/selection across environments. |
| `optional_services.searxng.probe` | `object` | Probe settings for an optional dependency service. |
| `optional_services.searxng.probe.enabled` | `boolean` | Whether periodic probing is enabled |
| `optional_services.searxng.probe.interval_s` | `number` | Probe interval in seconds |
| `optional_services.searxng.probe.path` | `anyOf` | Optional HTTP probe path |
| `optional_services.searxng.probe.timeout_s` | `number` | Probe timeout in seconds |
| `optional_services.searxng.timeout_s` | `number` | Connection timeout in seconds |
| `plugins` | `object` | Plugin loading configuration. Plugins are discovered via Python entry points (group: `crystalith.plugins`). This section controls which discovered plugins are enabled. |
| `plugins.disabled` | `array` | Plugins to skip loading (denylist). |
| `plugins.enabled` | `anyOf` | If set, only plugins in this list are loaded (allowlist). |
| `plugins.load_order` | `array` | Optional deterministic plugin load order. Plugins listed here (and enabled) are loaded last in the given order, so they win tie-breaks under last-wins conflict resolution. |
| `providers` | `object` | Reusable provider configurations (use YAML anchors) |
| `refine` | `object` | Content refinement settings. |
| `refine.formats` | `array` |  |
| `schema` | `string` | Schema version |
| `search` | `object` | Web search settings. |
| `search.searxng` | `object` | SearXNG search engine settings. |
| `search.searxng.api_key` | `anyOf` | Optional API key for authentication |
| `search.searxng.endpoint_candidates` | `array` | Optional candidate SearXNG endpoints. When host is empty, the runtime may lazily probe and select the first reachable endpoint on first use. |
| `search.searxng.host` | `string` | SearXNG instance URL. Empty disables web search. |
| `search.searxng.max_results` | `integer` | Maximum number of results |
| `search.searxng.timeout` | `integer` | Request timeout in seconds |
| `slides` | `object` | Slides workflow plugin selection settings. |
| `slides.default_plugin` | `anyOf` | Optional slides workflow plugin id to use as the active SLIDES provider. |
| `source_ingestion` | `object` | 来源导入配置。 |
| `source_ingestion.dedup` | `object` | 来源去重配置（可选）。 |
| `source_ingestion.dedup.enabled` | `boolean` | 是否启用来源去重（默认关闭） |
| `source_ingestion.url_fetch` | `object` | URL 内容获取配置。 |
| `source_ingestion.url_fetch.proxy` | `object` | HTTP 代理配置。 支持 HTTP/HTTPS/SOCKS5 代理协议，可作为 YAML anchor 被其他功能引用。 Example: proxy_settings: &default_proxy enabled: false http_url: "http://127.0.0.1:7890" https_url: "http://127.0.0.1:7890" socks5_url: null no_proxy: ["localhost", "127.0.0.1"] source_ingestion: url_fetch: proxy: *default_proxy |
| `source_ingestion.url_fetch.proxy.enabled` | `boolean` | 是否启用代理 |
| `source_ingestion.url_fetch.proxy.http_url` | `anyOf` | HTTP 代理 URL (例如 http://127.0.0.1:7890) |
| `source_ingestion.url_fetch.proxy.https_url` | `anyOf` | HTTPS 代理 URL (可选，默认使用 http_url) |
| `source_ingestion.url_fetch.proxy.no_proxy` | `array` | 不走代理的域名/IP列表 |
| `source_ingestion.url_fetch.proxy.socks5_url` | `anyOf` | SOCKS5 代理 URL (例如 socks5://127.0.0.1:1080) |
| `source_ingestion.url_fetch.retry_count` | `integer` | 重试次数 |
| `source_ingestion.url_fetch.retry_delay` | `number` | 重试间隔（秒） |
| `source_ingestion.url_fetch.security` | `object` | URL fetch SSRF 安全策略配置。 |
| `source_ingestion.url_fetch.security.allowlist_cidrs` | `array` | 显式允许的 CIDR 网段（例如 10.0.0.0/8）。 |
| `source_ingestion.url_fetch.security.allowlist_domains` | `array` | 显式允许的域名后缀（example.com 将匹配 example.com 和 *.example.com）。 |
| `source_ingestion.url_fetch.security.allowlist_hosts` | `array` | 显式允许的 host（精确匹配）。可用于受控环境下放行内部站点。 |
| `source_ingestion.url_fetch.security.allowlist_only` | `boolean` | 仅允许 allowlist 命中的 URL（默认 false：允许公网，但拒绝 localhost/私网/元数据等高风险目标）。 |
| `source_ingestion.url_fetch.security.max_redirects` | `integer` | URL fetch 最大重定向跳数（逐跳重验 SSRF 安全策略）。 |
| `source_ingestion.url_fetch.timeout` | `integer` | 请求超时时间（秒） |
| `source_ingestion.web_extraction` | `object` | 网页内容提取配置。 支持多种提取策略，按优先级自动降级： 1. trafilatura - 本地提取，速度快，无需外部服务 2. jina - Jina Reader API，免费且支持 JS 渲染 3. firecrawl - 外部 API，功能强大，需要 API 密钥 4. browserless - 浏览器渲染，适合复杂动态页面，需要服务 Example: web_extraction: fallback_order: ["trafilatura", "jina", "firecrawl", "browserless"] trafilatura: enabled: true output_format: "markdown" jina: enabled: true firecrawl: enabled: false api_key: "fc-xxx" browserless: enabled: false endpoint: "ws://localhost:3000" |
| `source_ingestion.web_extraction.browserless` | `object` | Browserless 浏览器渲染提取器配置。 |
| `source_ingestion.web_extraction.browserless.enabled` | `boolean` | 是否启用 Browserless 提取器 |
| `source_ingestion.web_extraction.browserless.endpoint` | `string` | Browserless WebSocket 端点 |
| `source_ingestion.web_extraction.browserless.timeout` | `integer` | 页面加载超时时间（秒） |
| `source_ingestion.web_extraction.browserless.token` | `anyOf` | 认证令牌（可选） |
| `source_ingestion.web_extraction.browserless.wait_until` | `string` | 页面等待条件 |
| `source_ingestion.web_extraction.enable_fallback` | `boolean` | 是否启用自动降级 |
| `source_ingestion.web_extraction.fallback_order` | `array` | 提取器降级顺序（按优先级排列） |
| `source_ingestion.web_extraction.firecrawl` | `object` | Firecrawl API 提取器配置。 |
| `source_ingestion.web_extraction.firecrawl.api_key` | `anyOf` | Firecrawl API 密钥 |
| `source_ingestion.web_extraction.firecrawl.enabled` | `boolean` | 是否启用 Firecrawl 提取器 |
| `source_ingestion.web_extraction.firecrawl.timeout` | `integer` | 请求超时时间（秒） |
| `source_ingestion.web_extraction.jina` | `object` | Jina Reader API 提取器配置。 |
| `source_ingestion.web_extraction.jina.api_key` | `anyOf` | Jina API 密钥（可选，用于更高配额） |
| `source_ingestion.web_extraction.jina.enabled` | `boolean` | 是否启用 Jina Reader 提取器 |
| `source_ingestion.web_extraction.jina.proxy` | `anyOf` | 代理配置（可选） |
| `source_ingestion.web_extraction.jina.timeout` | `integer` | 请求超时时间（秒） |
| `source_ingestion.web_extraction.trafilatura` | `object` | Trafilatura 本地提取器配置。 |
| `source_ingestion.web_extraction.trafilatura.enabled` | `boolean` | 是否启用 Trafilatura 提取器 |
| `source_ingestion.web_extraction.trafilatura.include_links` | `boolean` | 是否提取链接 |
| `source_ingestion.web_extraction.trafilatura.include_tables` | `boolean` | 是否提取表格 |
| `source_ingestion.web_extraction.trafilatura.output_format` | `string` | 输出格式 |
| `source_ingestion.web_extraction.trafilatura.proxy` | `anyOf` | 代理配置（可选） |
| `source_ingestion.web_extraction.trafilatura.timeout` | `integer` | 请求超时时间（秒） |
| `vector_storage` | `object` | Vector storage settings. |
| `vector_storage.chroma` | `object` | Chroma vector storage settings. |
| `vector_storage.chroma.endpoint_candidates` | `array` | Optional candidate Chroma HTTP endpoints (e.g. http://chromadb:8000, http://127.0.0.1:8001). When set, the loader may probe and select the first reachable endpoint and populate host/port. |
| `vector_storage.chroma.host` | `string` |  |
| `vector_storage.chroma.path` | `string` |  |
| `vector_storage.chroma.port` | `integer` |  |
| `vector_storage.chroma.telemetry` | `boolean` |  |
| `vector_storage.provider` | `string` |  |
| `version` | `string` | Configuration version |
