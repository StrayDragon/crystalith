## Context

Crystalith 后端使用 cl-logs 包进行日志输出，但缺少结构化格式、性能指标和分布式追踪。生产环境排查问题依赖手动日志搜索，效率低下。

## Goals / Non-Goals

- Goals:
  - JSON 结构化日志，每个请求带有唯一 request_id
  - 关键指标的 Prometheus 格式导出
  - 可选的 OpenTelemetry 追踪（默认关闭）
  - 健康检查端点支持容器编排
- Non-Goals:
  - 不部署监控栈（Grafana/Prometheus 实例）
  - 不实现自定义告警规则
  - 不修改前端日志

## Decisions

- Decision: 使用 OpenTelemetry 作为追踪框架
- Alternatives considered:
  - Jaeger client → 社区已迁移至 OpenTelemetry
  - 自定义追踪 → 不标准，无法与生态集成

- Decision: Prometheus 格式导出指标
- Alternatives considered:
  - StatsD → 需要额外的收集器
  - 自定义 JSON 指标 → 不与 Grafana 等工具兼容

## Risks / Trade-offs

- OpenTelemetry 依赖较重 → 追踪功能默认关闭，仅在需要时启用
- 结构化日志体积增大 → 可配置日志级别控制输出量

## Architecture Flow

```mermaid
flowchart TD
    subgraph "Request Lifecycle"
        A[HTTP Request] --> B[Middleware: Generate request_id]
        B --> C[Middleware: Start trace span]
        C --> D[Route Handler]
        D --> E[Service Layer]
        E --> F[AI Call<br>child span]
        E --> G[DB Query<br>child span]
        E --> H[Vector Search<br>child span]
        F --> I[Response]
        G --> I
        H --> I
        I --> J[Middleware: Record metrics<br>duration, status_code]
        J --> K[Middleware: End trace span]
    end

    subgraph "Observability Outputs"
        L["Structured Logs (JSON)<br>→ stdout / file"]
        M["Metrics<br>→ /metrics (Prometheus)"]
        N["Traces<br>→ OTLP endpoint (optional)"]
    end

    subgraph "Health Endpoints"
        O["/health → {status: 'alive'}"]
        P["/ready → check DB + Vector Store"]
    end
```

```mermaid
sequenceDiagram
    participant Client
    participant Middleware
    participant Handler
    participant AI as AI Provider
    participant DB

    Client->>Middleware: GET /v1/notebooks
    Middleware->>Middleware: request_id = uuid4()
    Middleware->>Middleware: Start span: "GET /v1/notebooks"
    Middleware->>Handler: Process request

    Handler->>DB: SELECT notebooks
    Note over DB: child span: "db.query"
    DB-->>Handler: results

    Handler-->>Middleware: 200 OK
    Middleware->>Middleware: Record: http_request_duration=45ms
    Middleware->>Middleware: Log: {"request_id": "abc", "method": "GET", "status": 200, "duration_ms": 45}
    Middleware-->>Client: Response
```

## Acceptance Criteria

- [ ] **AC-1**: 日志中间件在 `web/app.py` 的 FastAPI middleware 中注册
- [ ] **AC-2**: 日志格式兼容现有 `cl-logs`（`packages/cl-logs`）的 structlog 输出，JSON 模式下每行为有效 JSON
- [ ] **AC-3**: request_id 通过 `request.state.request_id` 传递，所有 `log.*()` 调用自动包含
- [ ] **AC-4**: `/health` 返回 `{"status": "alive"}`，响应时间 < 10ms
- [ ] **AC-5**: `/ready` 验证数据库连接（`AsyncDBManager`）和向量存储（`VectorStore`）可用性
- [ ] **AC-6**: `/metrics` 返回 Prometheus 文本格式，包含 `http_request_duration_seconds` histogram
- [ ] **AC-7**: `just test` 通过
- [ ] **AC-8**: 手动验证：请求一个 API 后，日志中出现 request_id、method、status、duration 字段

## Open Questions

- 是否需要前端性能指标（Core Web Vitals）？
