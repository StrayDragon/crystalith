## ADDED Requirements

### Requirement: 任务模型
系统 MUST提供 `Task` 模型，管理异步任务的状态和结果。

#### Scenario: 创建任务
- **WHEN** 用户触发长时间运行的操作（如音频生成）
- **THEN** 系统创建 Task 记录，状态为 `PENDING`

### Requirement: 任务状态
系统 MUST跟踪任务的生命周期状态。

#### Scenario: 任务状态流转
- **WHEN** 任务被处理
- **THEN** 状态依次为 `PENDING` → `RUNNING` → `COMPLETED` 或 `FAILED`

#### Scenario: 查询任务状态
- **WHEN** 客户端查询任务状态
- **THEN** 系统返回任务的当前状态、进度、结果或错误信息

### Requirement: 任务队列
系统 MUST提供 `TaskQueue` 类，管理任务的排队和执行。

#### Scenario: 任务入队
- **WHEN** 新任务创建
- **THEN** 系统将任务加入队列，按优先级排序

#### Scenario: 任务执行
- **WHEN** 队列中有待处理任务
- **THEN** 系统按顺序执行任务，支持并发限制

### Requirement: 任务类型
系统 MUST支持多种任务类型。

#### Scenario: 支持的任务类型
- **WHEN** 系统处理任务
- **THEN** 支持以下类型：`REFINE`、`AUDIO_OVERVIEW`、`VIDEO_OVERVIEW`、`DOCUMENT_PARSE`

### Requirement: 任务取消
系统 MUST支持取消排队中的任务。

#### Scenario: 取消任务
- **WHEN** 用户取消任务
- **THEN** 如果任务状态为 `PENDING`，系统将其标记为 `CANCELLED`

### Requirement: 任务 API
系统 MUST提供任务管理的 REST API。

#### Scenario: 任务状态 API
- **WHEN** 客户端调用 `/v1/tasks/{id}` 端点
- **THEN** 系统返回任务的详细状态和结果

#### Scenario: 任务列表 API
- **WHEN** 客户端调用 `/v1/notebooks/{id}/tasks` 端点
- **THEN** 系统返回该 Notebook 下的所有任务

### Requirement: 任务结果存储
系统 MUST持久化存储任务结果。

#### Scenario: 保存任务结果
- **WHEN** 任务完成
- **THEN** 系统将结果保存到 Task 记录，支持后续查询

---

## 技能要求

### 后端实现技能

1. **uv Python 项目管理** (`uv`)
   - 使用现有 asyncio 支持
   - 无需新增依赖

2. **Python 测试** (`python-testing`)
   - 测试任务入队和执行
   - 测试并发限制
   - 测试任务取消

3. **异步编程**
   - 使用 `asyncio.Queue` 管理任务队列
   - 使用 `asyncio.Semaphore` 限制并发
   - 使用 `asyncio.create_task` 启动后台任务

4. **cl-sqlalchemyx**
   - Task 模型继承 `AsyncSqlATableBase`
   - 使用 JSON 字段存储 payload 和 result

### 代码组织

```
backend/py/src/crystalith/tasks/
├── __init__.py
├── models.py                   # Task 数据库模型
├── types.py                    # TaskType, TaskStatus 枚举
├── queue.py                    # TaskQueue 类
├── worker.py                   # 任务执行器
└── api.py                      # Task API 路由
```

### 数据库模型

```python
class TaskType(StrEnum):
    REFINE = "refine"
    DOCUMENT_PARSE = "document_parse"
    AUDIO_OVERVIEW = "audio_overview"
    VIDEO_OVERVIEW = "video_overview"

class TaskStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class Task(AsyncSqlATableBase):
    __tablename__ = "tasks"

    id: Mapped[int]
    notebook_id: Mapped[int | None]  # FK → notebooks.id
    type: Mapped[TaskType]
    status: Mapped[TaskStatus]
    payload: Mapped[dict]  # JSON
    result: Mapped[dict | None]  # JSON
    error: Mapped[str | None]
    progress: Mapped[int]  # 0-100
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]
```

### TaskQueue 接口

```python
class TaskQueue:
    async def enqueue(self, task_type: TaskType, payload: dict, notebook_id: int | None = None) -> int:
        """创建任务并入队，返回 task_id"""

    async def get_status(self, task_id: int) -> Task:
        """获取任务状态"""

    async def cancel(self, task_id: int) -> bool:
        """取消任务（仅 PENDING 状态）"""

    async def start_worker(self, concurrency: int = 3) -> None:
        """启动后台 worker"""
```
