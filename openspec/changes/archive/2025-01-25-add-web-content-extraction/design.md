## Context

用户需要从各种网页导入全文内容用于 RAG 知识库。当前方案使用 httpx + BeautifulSoup 的简单组合，面临以下挑战：

- 许多网站使用 JavaScript 动态渲染内容
- 反爬虫机制导致请求被拒绝
- 复杂网页结构难以准确提取正文
- 不同网站需要不同的提取策略

背景约束：
- 需要支持自托管部署，不能强依赖外部付费服务
- 需要考虑成本和性能平衡
- 需要向后兼容现有的 URL 导入功能

## Goals / Non-Goals

**Goals:**
- 显著提高网页内容提取的成功率和质量
- 提供灵活的配置选项，适应不同部署场景
- 实现智能降级机制，确保最大兼容性
- 保持 API 接口向后兼容

**Non-Goals:**
- 不实现完整的爬虫功能（如递归抓取整站）
- 不处理需要登录认证的网页
- 不实现反反爬虫的复杂策略（如验证码破解）
- 本阶段不实现前端配置界面

## Decisions

### Decision 1: 分层提取架构

**方案**: 采用分层架构，按优先级尝试不同的提取方式。

```
┌─────────────────────────────────────────────────────────┐
│                    WebExtractor                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │ Trafilatura │→ │  Jina/API   │→ │   Browserless   │  │
│  │  (本地快速)  │  │ (外部服务)   │  │  (浏览器渲染)   │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**原因**:
- 本地优先：减少外部依赖，降低延迟和成本
- 渐进增强：简单页面快速处理，复杂页面有备选方案
- 灵活配置：用户可根据需求启用/禁用各层

### Decision 2: 本地提取器选择 - Trafilatura

**方案**: 使用 `trafilatura` 替代当前的 BeautifulSoup 方案。

```python
import trafilatura

def extract_with_trafilatura(html: str, url: str) -> ExtractedContent:
    result = trafilatura.extract(
        html,
        url=url,
        include_comments=False,
        include_tables=True,
        include_links=True,
        include_images=False,
        output_format='markdown',
        with_metadata=True,
    )
    return result
```

**原因**:
- 专为网页正文提取设计，准确率高于通用 HTML 解析器
- 支持多种输出格式（Markdown、TXT、JSON）
- 自动提取元数据（标题、作者、日期）
- 活跃维护，被 HuggingFace、Microsoft Research 等使用
- 纯 Python 实现，无外部依赖

**替代方案考虑**:
- `newspaper3k`: 功能类似但维护不活跃
- `readability-lxml`: 仅提取正文，不提取元数据
- `goose3`: 功能较弱，社区不活跃

### Decision 3: 外部 API 服务支持

**方案**: 支持多种外部 API 服务，通过统一接口调用。

| 服务 | 特点 | 定价 | 适用场景 |
|------|------|------|----------|
| Jina Reader | 免费额度大，返回 Markdown | 免费/按量 | 默认推荐 |
| Firecrawl | 功能强大，支持 JS 渲染 | $16+/月 | 企业用户 |
| 自定义端点 | 用户自建服务 | - | 特殊需求 |

```python
class ExternalExtractor(Protocol):
    async def extract(self, url: str) -> ExtractedContent: ...

class JinaReaderExtractor:
    """Jina Reader API - 前缀 r.jina.ai"""
    base_url = "https://r.jina.ai/"

    async def extract(self, url: str) -> ExtractedContent:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{self.base_url}{url}")
            return self._parse_response(response.json())

class FirecrawlExtractor:
    """Firecrawl API - 需要 API Key"""
    async def extract(self, url: str) -> ExtractedContent:
        # POST https://api.firecrawl.dev/v1/scrape
        ...
```

**原因**:
- Jina Reader 免费且易用，适合大多数场景
- Firecrawl 功能更强，适合有预算的用户
- 支持自定义端点，满足特殊部署需求

### Decision 4: 浏览器渲染支持 (Browserless)

**方案**: 支持连接 Browserless 服务进行 JavaScript 渲染。

```yaml
# config/app.yaml
web_extraction:
  browserless:
    enabled: false
    endpoint: "ws://localhost:3000"
    token: ""
    timeout: 30
```

```python
class BrowserlessExtractor:
    """通过 Browserless 服务渲染 JavaScript 页面"""

    async def extract(self, url: str) -> ExtractedContent:
        async with async_playwright() as p:
            browser = await p.chromium.connect_over_cdp(
                f"{self.endpoint}?token={self.token}"
            )
            page = await browser.new_page()
            await page.goto(url, wait_until="networkidle")
            html = await page.content()
            # 使用 trafilatura 处理渲染后的 HTML
            return trafilatura.extract(html, ...)
```

**原因**:
- Browserless 可自托管，无外部依赖
- 支持完整的 JavaScript 渲染
- 通过 Playwright 连接，API 稳定
- 作为最后的降级方案

**部署方式**:
```bash
docker run -p 3000:3000 ghcr.io/browserless/chromium
```

### Decision 5: 配置结构设计

**方案**: 在 `config/app.yaml` 中新增 `web_extraction` 配置节。

```yaml
web_extraction:
  # 提取策略：local_first | api_first | browser_first
  strategy: "local_first"

  # 本地提取器配置
  local:
    enabled: true
    engine: "trafilatura"  # trafilatura | beautifulsoup
    timeout: 10
    options:
      include_tables: true
      include_links: true
      output_format: "markdown"

  # 外部 API 配置
  api:
    enabled: false
    provider: "jina"  # jina | firecrawl | custom
    jina:
      # Jina Reader 免费，无需 API Key
      timeout: 30
    firecrawl:
      api_key: ""
      timeout: 30
    custom:
      endpoint: ""
      api_key: ""
      timeout: 30

  # 浏览器渲染配置
  browserless:
    enabled: false
    endpoint: "ws://localhost:3000"
    token: ""
    timeout: 60

  # 降级配置
  fallback:
    enabled: true
    max_attempts: 3
    # 降级顺序（按配置的 enabled 状态过滤）
    order: ["local", "api", "browserless"]
```

### Decision 6: 提取结果统一模型

**方案**: 定义统一的提取结果模型。

```python
@dataclass
class ExtractedContent:
    """网页内容提取结果"""
    text: str                          # 提取的正文（Markdown 格式）
    title: str | None = None           # 页面标题
    author: str | None = None          # 作者
    date: str | None = None            # 发布日期
    description: str | None = None     # 页面描述
    language: str | None = None        # 语言
    url: str | None = None             # 原始 URL
    extractor: str = "unknown"         # 使用的提取器
    extraction_time_ms: int = 0        # 提取耗时

    def to_chunks(self) -> list[Chunk]:
        """转换为 Chunk 列表用于索引"""
        ...
```

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| Trafilatura 对某些网站提取效果不佳 | 提供降级到外部 API 的选项 |
| 外部 API 服务可能不稳定或收费变化 | 支持多种服务，本地优先 |
| Browserless 增加部署复杂度 | 设为可选，默认禁用 |
| 新增依赖可能影响包体积 | trafilatura 是纯 Python，影响小 |
| 配置项增多可能造成困惑 | 提供合理默认值，大多数用户无需配置 |

## Migration Plan

1. **Phase 1: 本地提取器升级**
   - 添加 trafilatura 依赖
   - 实现 LocalExtractor 类
   - 替换现有 HTMLParser 在 URL 抓取中的使用
   - 保持 API 接口不变

2. **Phase 2: 外部 API 支持**
   - 实现 JinaReaderExtractor
   - 实现 FirecrawlExtractor
   - 添加配置项
   - 实现降级逻辑

3. **Phase 3: 浏览器渲染支持**
   - 实现 BrowserlessExtractor
   - 添加 playwright 可选依赖
   - 完善降级链

4. **回滚方案**
   - 配置 `web_extraction.local.engine: beautifulsoup` 可回退到原方案
   - 各组件独立，可单独禁用

## Open Questions

1. 是否需要在前端显示使用了哪种提取方式？
2. 是否需要支持用户手动选择提取方式？
3. Browserless 是否应该作为独立的可选依赖包？
4. 是否需要缓存提取结果以避免重复抓取？
