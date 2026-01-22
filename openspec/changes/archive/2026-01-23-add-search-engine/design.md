# 搜索引擎集成设计文档

## Context

Crystalith 需要接入真实搜索引擎以支持用户发现和添加外部来源。当前 `search_graph.py` 返回模拟数据，需要替换为真实搜索能力。

## Goals / Non-Goals

### Goals
- 提供可配置的搜索引擎集成
- 支持多种搜索类别（Web、Scholar、Docs）
- 保持代码可测试性（支持 mock）

### Non-Goals
- 不实现多个搜索提供者（先专注 SearXNG）
- 不实现复杂的结果排序/去重逻辑
- 不修改前端代码（API 保持兼容）
- 暂不实现搜索结果缓存（简化首版实现）

## Decisions

### Decision 1: 使用 LangChain SearXNG Wrapper

**选择**：使用 `langchain-community` 的 `SearxSearchWrapper`

**理由**：
1. 成熟稳定的封装，已处理 API 细节
2. 与项目现有的 pydantic-ai 生态兼容
3. 简化实现，减少代码量
4. 支持自定义引擎和结果数量

**使用方式**：
```python
from langchain_community.utilities import SearxSearchWrapper

search = SearxSearchWrapper(
    searx_host="http://localhost:8888",
    k=10  # max results
)
results = search.results(query, engines=["google", "bing"])
```

### Decision 2: 搜索类别到引擎映射

| Crystalith Mode | SearXNG Engines |
|-----------------|-----------------|
| Web             | google, bing, duckduckgo |
| Scholar         | google_scholar, arxiv |
| Docs            | github, gitlab |

### Decision 3: 简化模块结构

```
backend/py/src/crystalith/search/
├── __init__.py          # 公开接口 + SearXNG 实现
└── types.py             # SearchResult 类型定义
```

首版简化设计，不需要复杂的抽象层。

### Decision 4: 配置结构

```yaml
search:
  searxng:
    host: "http://localhost:8888"  # SearXNG 实例地址
    api_key: ""                    # 可选的 API Key（用于认证）
    timeout: 10                    # 请求超时（秒）
    max_results: 10                # 最大结果数
```

### Decision 5: 错误处理

- 搜索失败时返回空列表，不抛出异常
- 记录警告日志便于排查
- 保持 API 响应格式一致

## 依赖变更

需要添加依赖：
```toml
dependencies = [
    "langchain-community>=0.3.0",  # SearXNG wrapper
]
```

## Implementation Plan

1. 添加 `langchain-community` 依赖
2. 创建 `search/` 模块（types.py + __init__.py）
3. 更新 `config/models.py` 添加搜索配置
4. 更新 `search_graph.py` 集成真实搜索
5. 编写单元测试

## SearXNG 配置要求

用户需要确保 SearXNG 实例：
1. 启用了 JSON 输出格式（在 `settings.yml` 中配置）
2. 网络可访问
3. 可选：配置 API Key 进行访问控制

## Open Questions

- [x] 是否需要支持多个 SearXNG 实例作为 fallback？→ 暂不需要
- [ ] 是否需要在前端显示搜索引擎来源信息？
