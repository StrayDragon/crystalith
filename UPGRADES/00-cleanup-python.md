# 00-cleanup — v2 前置清理：删胶水 + 降级 Rivu + 删未使用依赖

> **最终方案**（2026-07-02 确认）：
> - **research / analysis / studio / refine / workspace / commands / source_connectors 全部是核心业务，不删除**
> - 外部服务（SearXNG、Chroma、Redis）都可以自部署，不需要害怕
> - 清理目标：**胶水代码**（多后端抽象、端点自动探测、探针监控）
>   + **未使用依赖**（Tambo / @ag-ui）
>   + **Rivu 降级**（删服务端状态机，v2 改为消息内嵌 JSON 渲染组件）
> - 全部 94 个端点保留，20 个 feature 保留

---

> **📌 部分步骤已由其他清理提交提前完成**（2026-07-06）：
> - ✅ **ollama_discovery.py** — 已删除（文件不存在，由 `agentdev: clean` 等提交移除）
> - ✅ **web/app.py 探针监控** — `_optional_*` 函数已移除（仅剩 `_default_optional_services_refresher` 壳）
> - ✅ **@ag-ui/core** — 已从 `package.json` 移除
> - ✅ **后端 Rivu 引用清理（部分）** — `UiEventReceipt` 模型已从 `db/models.py` 移除；`sessions/repo.py` 和 `qa/api.py` 中 `ui_state` 引用已删除
>
> ⚡ **以下步骤仍待执行**（文档命令可直接使用）：
> - 删除 `chroma_http.py`、`memory.py`、`browserless_extractor.py`、`compliance.py`
> - 简化 `factory.py`（砍多后端选择分支）
> - 简化 cache factory（砍 Redis 分支）
> - `endpoint_candidates.py` 降级
> - `features/ui/` + `ui_state.py` 删除
> - `routers.py` 移除 `ui_router` 注册
> - 前端 `rivuRuntime.ts`、`useChat.ts` rivu 逻辑、`TamboProvider.tsx` 删除
> - `@tambo-ai/react` 从 package.json 移除
> - 清理 `config/app.yaml` 死配置（`optional_services`、`redis_url_candidates`、`endpoint_candidates`）
> - 建 v1/v2 分支 + v1.0.0 tag

---

## 0. 分支操作

```bash
# ====== 保存 v1（给 Python 社区 fork） ======
git checkout main
git checkout -b v1
git push origin v1
git tag v1.0.0 -m "Crystalith v1 — 完整 Python 实现（FastAPI + pydantic-ai）"
git push origin v1.0.0

# ====== 回到 main 开始清理 ======
git checkout main
```

---

## 一、清理原则

| 特征 | 胶水代码（✂️ 删/降级） | 业务逻辑（✅ 保留） |
|------|---------------------|-------------------|
| 做什么 | 适配多部署环境、多后端选择、自动服务发现 | 实现用户可见的功能 |
| 谁需要 | 运维/部署阶段 | 用户 |
| 能否静态替代 | ✅ 一个常量/配置文件 | ❌ 需要动态逻辑 |
| 例子 | `endpoint_candidates.py`、探针监控 | `qa/service.py`、`research/graph.py` |

---

## 二、第 1 轮：死代码文件（删掉不影响任何功能）

这些文件的代码路径在当前配置下永远不会执行。

```bash
# 1.1 chroma_http.py — 远程 Chroma HTTP 客户端
#     进入条件：chroma.host 不为空。当前配置 host: "" → embedded 模式
#     代码路径从未触发
git rm backend/py/src/crystalith/shared/vector_storage/chroma_http.py

# 1.2 memory.py — 纯内存 dict 向量存储
#     factory 中有 memory provider 分支但从未被配置触发
git rm backend/py/src/crystalith/shared/vector_storage/memory.py

# 1.3 browserless_extractor.py — 需要额外部署 browserless 服务
#     当前 extractor 降级链：trafilatura → jina → firecrawl，不走 browserless
git rm backend/py/src/crystalith/shared/extraction/browserless_extractor.py

# 1.4 compliance.py — 插件合规检查（版本/依赖/入口点验证）
#     v2 不需要 entry-points 动态发现
git rm backend/py/src/crystalith/shared/plugins/compliance.py

git commit -m "refactor: remove dead code — chroma_http, memory, browserless, compliance"
```

---

## 三、第 2 轮：过度抽象的多后端胶水

```bash
# 2.1 vector_storage/factory.py — 删除多后端选择分支
#     改为直接返回 ChromaVectorStore（embedded），砍 provider 判断
git add backend/py/src/crystalith/shared/vector_storage/factory.py
git commit -m "refactor: simplify vector_storage factory — remove multi-backend selection"

# 2.2 cache factory — 删除 Redis 分支
#     改为直接返回内存缓存
git add backend/py/src/crystalith/shared/cache/
git commit -m "refactor: simplify cache factory — remove Redis branch"
```

---

## 四、第 3 轮：端点自动发现降级 (~500 行)

```bash
# 3.1 ollama_discovery.py — HTTP 探测 Ollama 模型列表 → 自动注册 ModelConfig
#     降级：auto_discover_ollama() → return 0（不做任何 HTTP 探测）
git add backend/py/src/crystalith/shared/config/ollama_discovery.py
git commit -m "refactor: downgrade ollama_discovery — no more HTTP probes, return 0"

# 3.2 endpoint_candidates.py — 并发 HTTP 健康检查多个候选 endpoint
#     降级：order_endpoint_candidates() → return candidates[:1]（取第一个）
git add backend/py/src/crystalith/shared/config/endpoint_candidates.py
git commit -m "refactor: downgrade endpoint_candidates — return first, no more HTTP probes"
```

---

## 五、第 4 轮：web/app.py 探针监控 (~350 行)

`web/app.py` 249-680 行区间是为「多可选服务」设计的探针监控层。函数清单：

| 函数 | 行号 | 做什么 | 操作 |
|------|------|------|------|
| `_optional_recovery_hint` | 249 | 给每种服务返回"启动 overlay"提示 | ✂️ 删 |
| `_optional_error_code` | 259 | CHROMA_UNAVAILABLE 等错误码 | ✂️ 删 |
| `_model_provider` | 269 | 从 ModelConfig 提取 provider 名 | ✅ 保留 |
| `_is_ollama_enabled` | 273 | 判断是否启用了 Ollama | ⚠️ 保留+简化 |
| `_build_optional_status_template` | 285 | 构造所有可选服务的初始状态 | ✂️ 删 |
| `_finalize_optional_status` | 418 | 填充探测结果 | ✂️ 删 |
| `_refresh_optional_services_status` | 446 | 并发探测 Ollama/Chroma/Redis/SearXNG | ✂️ 删 |
| `_optional_services_snapshot` | 596 | 获取探测结果快照 | ✂️ 删 |
| `_run_optional_services_monitor` | 653 | 后台周期性探测 | ✂️ 删 |
| `_default_optional_services_refresher` | 710 | 默认刷新器工厂 | ✂️ 删 |

```bash
# 删除 _optional_recovery_hint 到 _run_optional_services_monitor 之间的函数
# dependency_health 端点简化：只查 Ollama 连接 + DB 连接
git add backend/py/src/crystalith/web/app.py
git commit -m "refactor: remove optional service probe monitoring (~350 lines)"
```

---

## 六、第 5 轮：简化 prompt_presets + templates（保留逻辑，砍 CRUD API）

```bash
# 5.1 prompt_presets — 删除 4 个 CRUD API 端点
#     保留 list_all_presets() + resolve_preset() 两个 service 函数（qa 依赖）
#     从 routers.py 移除 prompt_presets_router 注册
git add backend/py/src/crystalith/features/prompt_presets/ \
        backend/py/src/crystalith/web/routers.py
git commit -m "refactor: remove prompt_presets CRUD API — keep service functions"

# 5.2 templates — 删除 6 个 CRUD API 端点
#     保留 ensure_builtin_templates()（web/app.py 启动时调用）
#     从 routers.py 移除 templates_router 注册
git add backend/py/src/crystalith/features/templates/ \
        backend/py/src/crystalith/web/routers.py
git commit -m "refactor: remove templates CRUD API — keep builtin init"
```

---

## 七、第 6 轮：Rivu 降级

> 决策：Rivu（owner 自己的库），保留"AI 推送可交互组件"理念，降级实现方式。
> v2 替代：AI 消息返回结构化 JSON → 前端直接渲染组件（省掉服务端状态机 round-trip）

### 6.1 删除后端 Rivu（features/ui/ + ui_state.py + UiEventReceipt 表）

```bash
# 后端 ui feature — POST /v1/.../ui/event 端点
git rm -r backend/py/src/crystalith/features/ui/

# ui_state.py — apply_state_delta() + ensure_session_shared_state()
git rm backend/py/src/crystalith/shared/ui_state.py

# db/models.py — 删除 UiEventReceipt 模型
# sessions/repo.py + qa/api.py — 删除 ui_state 引用
# routers.py — 移除 ui_router 注册
# web/app.py — 移除 ui 初始化 + rivu_server_sdk 相关

# alembic — 标记 ui_event_receipts migration 为废弃（或保留不删）
git add backend/py/src/crystalith/ web/app.py \
        backend/py/src/crystalith/shared/db/models.py \
        backend/py/src/crystalith/web/routers.py \
        backend/py/src/crystalith/features/sessions/repo.py \
        backend/py/src/crystalith/features/qa/api.py
git commit -m "refactor: remove Rivu backend — drop ui feature + ui_state + UiEventReceipt"
```

### 6.2 降级前端 Rivu 运行时

```bash
# 删除 rivuRuntime.ts — 整个文件
git rm frontend/web/src/features/workspace/domains/messages/rivuRuntime.ts

# ChatPanel.tsx — 删除 MessageMounts / useKernelState / ComponentRenderer
#   改为：AI 消息返回后，从 content 中解析结构化 JSON → 直接渲染组件
#   （v2 重新实现，当前先删掉，消息渲染退回纯文本）
# useChat.ts — 删除 rivuRuntime 相关逻辑
git add frontend/web/src/features/workspace/domains/messages/ChatPanel.tsx \
        frontend/web/src/features/workspace/domains/messages/useChat.ts \
        frontend/web/src/features/workspace/layout/WorkspaceLayout.tsx
git commit -m "refactor: downgrade Rivu runtime — remove round-trip, will replace with inline JSON rendering in v2"
```

**v2 替代架构**：
```typescript
// v2 方案：AI 消息内嵌组件（不经过服务端状态机）
interface AIMessage {
  text: string;
  citations: Citation[];
  components?: UIMount[];  // 直接嵌在消息 JSON 里
}

// 前端渲染
{message.components?.map(c => <DynamicComponent type={c.type} props={c.props} />)}
```

---

## 八、第 7 轮：删除未使用的前端 AI UI 依赖

### 7.1 删除 Tambo

```bash
# TamboProvider — 套了层 Provider 但没有任何组件通过 Tambo API 渲染
# AnswerCard/BarChartCard/DataTableCard 是 ChatPanel 里直接 import 用的
git rm frontend/web/src/features/workspace/shared/tambo/TamboProvider.tsx

# App.tsx — 移除 <TamboProvider> wrapper，直接 <LayerProvider>
git add frontend/web/src/app/App.tsx
git commit -m "refactor: remove unused Tambo provider"

# package.json
# 移除 "@tambo-ai/react": "^1.1.0"
```

### 7.2 删除 @ag-ui/core

```bash
# package.json — 移除 "@ag-ui/core": "^0.0.47"
# 源代码中零引用，纯死依赖

git add frontend/web/package.json
pnpm install  # 更新 lockfile
git add frontend/web/pnpm-lock.yaml
git commit -m "refactor: remove unused dependencies — @ag-ui/core"
```

---

## 九、第 8 轮：清理 config/app.yaml 死配置

```bash
# 删除以下 sections：
#   optional_services.chroma    — embedded chroma 不走这里
#   optional_services.redis     — 不再需要
#   cache.redis_url_candidates
#   vector_storage.endpoint_candidates
#   search.searxng.endpoint_candidates

git add config/app.yaml
git commit -m "refactor: remove dead config sections from app.yaml"
```

---

## 十、清理前后对比

| 维度 | 清理前 | 清理后 | 变化 |
|------|-------|-------|------|
| **Feature 模块** | 21 | **20**（-1: ui/） | 核心业务全保留 |
| **API 端点** | 94 | **~92**（-2: ui/） | 业务端点全保留 |
| **后端行数** | ~19,000 | **~16,500** | -2,500 |
| **前端行数** | ~26,000 | **~25,800** | -200 |

| 删除清单 | 行数 | 状态 |
|----------|------|:----:|
| `chroma_http.py` | 353 | ❌ 待执行 |
| `memory.py` | 161 | ❌ 待执行 |
| `browserless_extractor.py` | 383 | ❌ 待执行 |
| `compliance.py` | 139 | ❌ 待执行 |
| `features/ui/` 整个目录 | ~180 | ❌ 待执行 |
| `shared/ui_state.py` | 115 | ❌ 待执行 |
| `web/app.py` 探针监控 | ~350 | ✅ 已由其他提交完成 |
| `ollama_discovery.py` 降级 | ~330 | ✅ 已由其他提交完成 |
| `endpoint_candidates.py` 降级 | ~160 | ❌ 待执行 |
| `prompt_presets/api.py` CRUD | ~150 | ❌ 待执行 |
| `templates/api.py` CRUD | ~200 | ❌ 待执行 |
| cache factory Redis | ~50 | ❌ 待执行 |
| config dead sections | ~40 | ❌ 待执行 |
| 前端 Tambo + rivuRuntime + MessageMounts | ~210 | ❌ 待执行 |
| npm 依赖 @tambo-ai/react | — | ❌ 待执行 |
| npm 依赖 @ag-ui/core | — | ✅ 已由其他提交完成 |
| **合计剩余待移除** | **~2,200 行（~5.5%）** | |

**所有业务逻辑完好无损。94 个端点中 ~92 个保留。research 13 端点、studio 8 端点、analysis 1 端点、refine 2 端点——全部保留。**

---

## 十一、验证

```bash
cd backend/py
just test          # 预期：所有 non-removed 测试通过
just typecheck     # 预期：无新错误
uv run python main.py  # 预期：启动成功，无 import error

cd frontend/web
pnpm install       # 更新 lockfile
pnpm dev           # 预期：前端正常启动
```

---

## 十二、下一步

```bash
# 清理完成后，创建 v2 分支
git checkout main
git checkout -b v2
echo "server/" >> .gitignore
git commit -m "feat(v2): create v2 branch from cleaned main"
```

- `v1` = 完整 Python 实现，给社区 fork
- `main` = 清理后的 Python 骨架，作为 v2 行为参考
- `v2` = TypeScript 重写（从清理后的 main 创建）
