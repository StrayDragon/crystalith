# BDD 测试 Handoff 文档

> 最后更新: 2026-06-12

## 概述

为 Crystalith 后端添加 pytest-bdd 中文 BDD 测试，覆盖全部 20 个领域 feature + 5 个 shared infrastructure feature。

## 当前状态

### 通过率: 73/105 (70%)

排除 LLM 依赖场景后: **73/78 通过 (94%)**

### 按 Feature 通过情况

| Feature | 场景 | 通过 | 状态 |
|---|---|---|---|
| 笔记本管理 | 5 | 5 | ✅ |
| 会话管理 | 5 | 5 | ✅ |
| 消息管理 | 4 | 4 | ✅ |
| 任务管理 | 4 | 4 | ✅ |
| 工作空间 | 3 | 3 | ✅ |
| 笔记本分析 | 3 | 3 | ✅ |
| 来源管理 | 4 | 3 | ⚠️ dedup_key |
| 来源标签 | 7 | 7 | ✅ |
| 引用管理 | 4 | 4 | ✅ |
| 模型管理 | 4 | 3 | ⚠️ provider |
| 命令系统 | 4 | 4 | ✅ |
| 提示词预设 | 6 | 6 | ✅ |
| 模板管理 | 8 | 8 | ✅ |
| 幻灯片工作室 | 8 | 8 | ✅ |
| 来源连接器 | 5 | 5 | ✅ |
| 界面状态 | 4 | 1 | ⚠️ 组件注册 |
| 内容精炼 | 6 | 0 | 🔒 LLM mock |
| 知识问答 | 10 | 0 | 🔒 LLM mock |
| 结构化输出 | 11 | 0 | 🔒 LLM mock |
| 深度研究 | 17 | 0 | 🔒 LLM mock + SSE |

## 架构

### 核心文件

| 文件 | 职责 |
|---|---|
| `tests/bdd/conftest.py` | Session 级 event_loop, module 级 app/client, function 级 db_session |
| `tests/bdd/公共步骤.py` | 全部共享 Given/When/Then 步骤 (~120 个步骤函数) |
| `tests/bdd/step_defs/conftest.py` | SSE 解析 fixtures |
| `tests/bdd/step_defs/test_*.py` | 20 个 feature 的 @scenario 绑定 |
| `tests/bdd/shared/step_defs/` | 5 个 shared infrastructure feature (待实现) |

### 关键设计决策

1. **同步步骤函数**: pytest-bdd 8.x 不支持 async 步骤。所有步骤通过 `event_loop.run_until_complete()` 运行异步操作
2. **Session 级 event_loop**: 所有 BDD 步骤共用一个事件循环，避免 fixture scope 冲突
3. **模板变量解析**: `_resolve_path()` 支持 `{fixture[key]}` 语法，通过 `request.getfixturevalue()` 动态解析
4. **Docstring 处理**: POST/PATCH 步骤使用 `parsers.parse('发送 POST 请求"{路径}"，内容为：')` + `doc_string` 参数接收 Gherkin docstring
5. **测试配置**: `make_settings()` 使用 memory cache + InMemoryVectorStore，无外部依赖

### conftest.py 结构

```python
@pytest.fixture(scope="session")
def event_loop(): ...           # 共享事件循环

@pytest.fixture(scope="module")
def test_settings(): ...        # 内存配置

@pytest.fixture(scope="module")
def app(event_loop, test_settings): ...  # FastAPI 应用 + SQLite 迁移

@pytest.fixture(scope="module")
def client(event_loop, app): ...  # httpx.AsyncClient

@pytest.fixture
def db_session(event_loop, app): ...  # 数据库会话

@pytest.fixture
def 响应上下文(): ...  # 步骤间共享的响应数据

@pytest.fixture
def 资源标识(): ...    # 测试资源 ID
```

## 已知问题

### 1. 来源去重提示 (1 场景)
- **原因**: Given 步骤 `笔记本中有一篇来源"重复文档.md"` 直接在 DB 创建 Source，未设置 `dedup_key`。上传端点通过文件内容 hash 检测重复，两者 key 不匹配
- **修复**: 需要在 Given 步骤中计算并设置 `dedup_key`

### 2. 模型详情 (1 场景)
- **原因**: test_settings 中 `provider: "test"` 被 models API 过滤（provider 不可用）
- **修复**: 配置一个 models API 认可的 test provider，或 mock models 端点

### 3. 界面状态事件 (3 场景)
- **原因**: UI 组件 `test-component` 未注册。POST `/ui/event` 返回 404 "component not found"
- **修复**: 在测试 conftest 中注册 mock UI 组件，或 mock UI event handler

## 待实现

### Phase 4: LLM Mock (27 场景)

需要为以下 feature 添加 LLM provider mock:

| Feature | 场景 | 复杂度 |
|---|---|---|
| 内容精炼 | 6 | 中 (task queue + LLM) |
| 知识问答 | 10 | 高 (RAG + SSE 流) |
| 结构化输出 | 11 | 高 (task queue + LLM) |
| 深度研究 | 17 | 高 (多轮迭代 + SSE) |

**方案**: 在 conftest.py 中注册 mock LLM provider，返回固定的 completion 响应。需要 mock:
- `crystalith.shared.ai_providers` 中的 provider 接口
- Task queue 的后台执行（同步执行而非异步）

### Phase 5: Shared Infrastructure Features (26 场景)

5 个 shared feature 测试底层组件（非 HTTP API）:

| Feature | 场景 | 需要 |
|---|---|---|
| 向量存储 | 5 | 直接测试 InMemoryVectorStore |
| 缓存系统 | 7 | 直接测试 memory/redis cache |
| 并发控制 | 4 | 测试锁机制 |
| 上下文窗口 | 5 | 测试 token counting |
| AI提供者 | 5 | 测试 provider 接口 |

**方案**: 每个 feature 需要独立的 conftest fixtures 和步骤实现。shared/step_defs 的 feature 路径已修复 (`../features/` 而非 `../features/features/`)。

### Phase 6: 清理

- 逐步替换 `tests/` 下的现有 pytest 测试（已被 BDD 覆盖的）
- 将 `tests/bdd/` 移到 `tests/` 顶层
- 更新 justfile 和 CI 配置

## 运行命令

```bash
# 全部 BDD 测试
cd backend/py && just test-bdd

# 仅领域测试（排除 LLM 依赖）
cd backend/py && PYTHONHASHSEED=0 TZ=UTC uv run pytest tests/bdd/step_defs/ -v --no-cov -m bdd -k "not 精炼 and not 问答 and not 输出 and not 流式"

# 单个 feature
cd backend/py && PYTHONHASHSEED=0 TZ=UTC uv run pytest tests/bdd/step_defs/test_会话管理.py -v --no-cov -m bdd
```

## 文件清单

```
tests/bdd/
├── _HANDOFF.md                    # 本文档
├── conftest.py                    # BDD 根 conftest
├── 公共步骤.py                    # 共享步骤定义 (~120 步骤)
├── features/                      # 20 个领域 feature 文件
│   ├── analysis/笔记本分析.feature
│   ├── citations/引用管理.feature
│   ├── commands/命令系统.feature
│   ├── messages/消息管理.feature
│   ├── models/模型管理.feature
│   ├── notebooks/笔记本管理.feature
│   ├── outputs/结构化输出.feature
│   ├── prompt_presets/提示词预设.feature
│   ├── qa/知识问答.feature
│   ├── refine/内容精炼.feature
│   ├── research/深度研究.feature
│   ├── sessions/会话管理.feature
│   ├── source_connectors/来源连接器.feature
│   ├── sources/来源管理.feature
│   ├── sources/来源标签.feature
│   ├── studio/幻灯片工作室.feature
│   ├── tasks/任务管理.feature
│   ├── templates/模板管理.feature
│   ├── ui/界面状态.feature
│   └── workspace/工作空间.feature
├── shared/                        # 5 个 shared infrastructure features
│   ├── features/
│   │   ├── AI提供者.feature
│   │   ├── 上下文窗口.feature
│   │   ├── 向量存储.feature
│   │   ├── 并发控制.feature
│   │   └── 缓存系统.feature
│   └── step_defs/
│       ├── conftest.py
│       └── test_*.py
└── step_defs/                     # 20 个领域 step_defs
    ├── conftest.py                # SSE 解析 fixtures
    └── test_*.py                  # @scenario 绑定
```
