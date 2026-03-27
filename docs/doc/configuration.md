# 配置

Crystalith 运行时配置位于 `config/app.yaml`。

## 基础

- 密钥不要提交到 git。优先使用 `config/secret.env`（dotenv，自动发现）。
- 配置支持：
  - `{{ env.VAR }}` 模板变量（来自 `os.environ` + `.env`，`.env` 覆盖系统 env）
  - `{{ secret.VAR }}` 模板变量（来自 `config/secret.env`）
  - YAML 锚点复用
- 影响运行时/部署行为的环境变量索引见：[环境变量参考（生成）](reference/env-vars.gen.md)

## 常用设置

完整的配置键索引（含嵌套路径）见 [配置 Schema 参考（生成）](reference/config-schema.gen.md)。

## 网页搜索（SearXNG）

Crystalith 的网页搜索 / 深度研究功能使用 SearXNG。当 `search.searxng.host` 为空时，网页搜索被禁用。

启用方式：
- 配置：在 `config/app.yaml` 中设置 `search.searxng.host` **或** `search.searxng.endpoint_candidates`

Profile 选项：
- 在 `.env` 中将 `searxng` 包含在 `HYBRID_SERVICES` / `DOCKER_SERVICES` / `FULL_SERVICES` 中（默认已包含）
- 或手动添加 compose overlay：`deployments/prod/docker-compose.searxng.yml`

## API 认证（自托管）

Crystalith 可选地要求所有 `/v1/**` 端点使用 API key。

配置：

```yaml
app:
  auth:
    enabled: true
    api_key: "{{ secret.CRYSTALITH_API_KEY }}"
```

注意：
- 优先使用 `{{ env.* }}` / `{{ secret.* }}` 避免提交密钥。
- 客户端需发送 `Authorization: Bearer <token>`（或 `X-API-Key: <token>`）。
- `/health` 和 `/health/dependencies` 保持匿名访问，用于健康探针。

## Redis embedding 缓存

当 `cache.provider=redis` 时，后端可启用跨请求的 embedding 缓存，减少小批量重复 embedding 开销。

配置：
- `cache.provider: redis|auto`
- `cache.redis_url` / `cache.redis_url_candidates`

环境变量（默认值见 `backend/py/src/crystalith/shared/deps.py`）：
- 参见 [环境变量参考（生成）](reference/env-vars.gen.md)

基准测试（需要 Redis + 可选依赖 `redis`）：
- `cd backend/py && just embedding-cache-bench`
  - 加 `--reset-prefix` 清除基准测试 key 空间
  - 加 `--scan-keys` 统计基准前缀的 key 数量（大库可能较慢）
  - 加 `--use-real-embedder --confirm-real-embedder` 使用配置的 embedding 提供商

## URL 抓取 SSRF 防护

`POST /v1/notebooks/{notebook_id}/sources/from-url` 支持 `mode: fetch`，会发起服务端 HTTP 请求。

默认情况下，Crystalith 会阻止高风险目标（localhost / 私有网络 / 云元数据 IP）以缓解 SSRF。

配置（`config/app.yaml`）：
- `source_ingestion.url_fetch.security.allowlist_hosts`：允许的精确主机名
- `source_ingestion.url_fetch.security.allowlist_domains`：允许的域名后缀（匹配 `example.com` 和 `*.example.com`）
- `source_ingestion.url_fetch.security.allowlist_cidrs`：允许的 CIDR 范围（谨慎使用）
- `source_ingestion.url_fetch.security.allowlist_only`：为 true 时，阻止所有未在白名单中的目标
- `source_ingestion.url_fetch.security.max_redirects`：重定向跳数限制（每跳都会重新验证）

安全提示：白名单内部网段可能重新引入 SSRF 风险（内部端口访问、元数据访问等）。优先白名单最小范围的特定主机/域名。

## 资料去重（可选）

Crystalith 可选地检测重复资料：
- 文件上传：`POST /v1/notebooks/{notebook_id}/sources`
- URL 导入：`POST /v1/notebooks/{notebook_id}/sources/from-url`

配置（`config/app.yaml`）：
- `source_ingestion.dedup.enabled`（默认：false）

去重键（实现）：
- 上传：`sha256(file_bytes)`
- URL：规范化 URL（去除 `utm_*` 等跟踪参数，标准化 scheme/host/path，排序 query）后哈希

启用后，去重命中**不会**静默丢弃请求：
- API 可能返回 `409`，`error_code=SOURCE_DEDUP_HIT`，UI 会提示：
  - 复用已有资料，或
  - 仍然创建新资料。
- 也可通过 `dedup_action` 查询参数显式控制：
  - `dedup_action=reuse`
  - `dedup_action=create_new`

## 资料导入故障排查

当资料进入 `FAILED` 状态时，资料列表/详情 API 可能包含诊断字段：
- `error_code`
- `error_message`
- `recovery_hint`
- `last_error_at`

常见 `error_code` 及修复方法：
- `PARSER_FAILED`：解析器崩溃。尝试转换为纯文本/Markdown 后重新上传。
- `URL_FETCH_BLOCKED`：SSRF 防护阻止了 URL。使用公网 URL 或调整上述白名单设置。
- `EXTRACTOR_TIMEOUT`：网页提取超时。重试或切换其他提取器。
- `EXTRACTOR_FAILED`：网页提取失败。重试、切换提取器，或检查网站是否需要登录/阻止爬虫。
- `OPTIONAL_SERVICE_UNAVAILABLE`：可选依赖不可用/配置错误。检查服务连通性/配置。
- `EMBEDDING_FAILED`：embedding 提供商失败。检查模型/提供商配置和可用性。
- `VECTOR_STORE_FAILED`：向量存储失败。检查向量存储配置/服务状态。
- `SOURCE_INGESTION_FAILED`：通用回退，无法确定具体原因。检查日志和可选服务健康状态。

## 速度 / 质量调优

许多生成端点接受 `preference: "quality" | "speed"`。

- 默认值由 `(OutputType, preference)` 选择，仅在调用方未显式覆盖请求参数（如 `top_k`、`min_score`）时应用。
- `quality` 倾向于以更高延迟换取更好的上下文覆盖（例如启用多查询检索）。
- `speed` 倾向于降低检索/生成开销以减少延迟。

### 多查询覆盖（环境变量）

`CRYSTALITH_RETRIEVAL_MULTI_QUERY` 可全局强制开启/关闭多查询检索：

- 未设置：遵循 `(OutputType, preference)` 默认调优
- 真值：强制开启
- 假值（`0`、`false`、`no`、`off`）：强制关闭

## 密钥

后端会自动发现并读取 `config/app.yaml` 同目录下的 `config/secret.env`（dotenv 格式）。

快速创建：

```bash
cp config/secret.env.example config/secret.env
```

详见 `部署与开发`。
