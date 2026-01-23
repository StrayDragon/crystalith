## Context

用户报告了两个相关问题：
1. 从全屏搜索结果弹窗点击"作为全文导入"时，进度对话框层叠显示异常
2. 后端抓取某些网页（如 Google NotebookLM 等）时返回 400 错误

背景约束：
- 前端使用 Material Tailwind 的 Dialog 组件，需要正确管理多层对话框的 z-index
- 后端当前使用 httpx 直接发送 HTTP 请求，部分网站会阻止非浏览器请求
- 部分用户网络环境可能需要代理才能访问外部网站

## Goals / Non-Goals

**Goals:**
- 修复对话框 z-index 层叠问题，提供流畅的用户体验
- 提高网页内容抓取的成功率（至少支持静态页面）
- 提供清晰的错误信息帮助用户理解失败原因
- 支持可选的代理配置

**Non-Goals:**
- 本阶段不引入完整的浏览器自动化（playwright）方案，这将作为后续增强
- 不支持需要登录认证的网页
- 不处理 JavaScript 渲染的单页应用（SPA）

## Decisions

### Decision 1: 对话框层叠处理
**方案**: 当从全屏搜索结果对话框触发"添加来源"时，先关闭全屏对话框，再打开添加进度对话框。

**原因**:
- 避免复杂的多层 z-index 管理
- 简化用户心智模型
- Material Tailwind Dialog 不支持嵌套

**替代方案考虑**:
- 使用 Portal 和自定义 z-index：增加复杂性，可能与 Material Tailwind 冲突
- 在全屏对话框内嵌入进度组件：破坏组件职责分离

### Decision 2: HTTP 请求头优化
**方案**: 添加常见浏览器的请求头来伪装成真实浏览器请求。

```python
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}
```

**原因**: 许多网站会检查 User-Agent 来阻止非浏览器请求

### Decision 3: 代理配置支持（使用 YAML Anchor）
**方案**: 在 `config/app.yaml` 中添加全局代理配置作为 YAML anchor，各功能可按需引用或覆盖。

```yaml
# 全局代理配置（作为 anchor）
proxy_settings: &default_proxy
  enabled: false
  http_url: "http://127.0.0.1:7890"
  https_url: "http://127.0.0.1:7890"
  socks5_url: null  # 例如 "socks5://127.0.0.1:1080"
  no_proxy: ["localhost", "127.0.0.1"]

# 网页抓取功能配置
source_ingestion:
  url_fetch:
    proxy: *default_proxy  # 引用全局代理配置
    timeout: 30
    retry_count: 2
    headers:
      user_agent: "Mozilla/5.0 ..."

# 搜索引擎配置（可单独配置代理）
search_engine:
  proxy:
    <<: *default_proxy
    enabled: true  # 覆盖：搜索引擎启用代理

# 后续功能可按需引入
# some_feature:
#   proxy: *default_proxy
```

**原因**:
- 使用 YAML anchor 实现配置复用和灵活覆盖
- 各功能可独立控制是否使用代理
- 支持多种代理协议（HTTP/HTTPS/SOCKS5）
- 提供 no_proxy 配置避免内网请求走代理
- 为未来功能预留扩展点（如在线配置界面）

**未来考虑**：
- 可在前端设置界面添加代理配置入口
- 支持按功能在线开启/关闭代理

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| 伪装请求头可能不足以绑过某些反爬机制 | 提供清晰错误提示，建议用户使用"保存链接"模式 |
| JavaScript 渲染页面仍无法抓取 | 文档说明限制，后续考虑 playwright 方案 |
| 代理配置增加部署复杂度 | 设为可选，默认不启用 |

## Migration Plan

1. 前端修复可直接部署，无需迁移
2. 后端新增配置字段有默认值，向后兼容
3. 无破坏性变更

## Open Questions

1. 是否需要在 UI 上区分"简单抓取"和"高级抓取"模式？
2. 是否需要支持用户自定义 User-Agent？
3. 后续 playwright 方案应作为独立提案还是本提案的扩展？
