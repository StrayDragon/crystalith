## ADDED Requirements

### Requirement: 会话模型
系统必须提供 `Session` 模型，管理用户与 Notebook 的对话会话。

#### Scenario: 创建会话
- **WHEN** 用户在 Notebook 中开始新对话
- **THEN** 系统创建新的 Session 记录，关联到 Notebook

#### Scenario: 列出会话
- **WHEN** 用户查看 Notebook 的会话列表
- **THEN** 系统返回该 Notebook 下所有会话，按更新时间倒序

### Requirement: 消息模型
系统必须提供 `Message` 模型，存储会话中的消息历史。

#### Scenario: 保存消息
- **WHEN** 用户发送问题或系统生成回答
- **THEN** 系统创建 Message 记录，包含角色、内容、引用、时间戳

#### Scenario: 获取消息历史
- **WHEN** 用户打开会话
- **THEN** 系统返回该会话的所有消息，按时间顺序

### Requirement: 会话上下文
系统必须在问答时使用会话历史作为上下文。

#### Scenario: 多轮对话
- **WHEN** 用户在同一会话中连续提问
- **THEN** 系统将之前的消息作为上下文，生成连贯的回答

### Requirement: 会话标题
系统必须支持会话标题的自动生成和手动修改。

#### Scenario: 自动生成标题
- **WHEN** 会话创建后首次提问
- **THEN** 系统根据问题内容自动生成会话标题

#### Scenario: 修改标题
- **WHEN** 用户编辑会话标题
- **THEN** 系统更新 Session 记录的标题字段

### Requirement: 会话删除
系统必须支持删除会话及其所有消息。

#### Scenario: 删除会话
- **WHEN** 用户删除会话
- **THEN** 系统删除 Session 记录及关联的所有 Message 记录

### Requirement: 会话 API
系统必须提供会话管理的 REST API。

#### Scenario: 会话 CRUD API
- **WHEN** 客户端调用 `/v1/notebooks/{id}/sessions` 端点
- **THEN** 系统支持创建、列出、获取、更新、删除会话

#### Scenario: 消息 API
- **WHEN** 客户端调用 `/v1/sessions/{id}/messages` 端点
- **THEN** 系统支持创建、列出消息

---

## 技能要求

### 后端实现技能

1. **uv Python 项目管理** (`uv`)
   - 使用现有 SQLAlchemy 依赖
   - 无需新增依赖

2. **Python 测试** (`python-testing`)
   - 测试 Session CRUD 操作
   - 测试 Message 创建和查询
   - 测试级联删除

3. **cl-sqlalchemyx**
   - Session 和 Message 模型继承 `AsyncSqlATableBase`
   - 使用 relationship 定义关联

4. **API 设计**
   - 使用 Pydantic 定义 SessionCreate, SessionRead, MessageCreate, MessageRead
   - 分页查询使用 offset/limit

### 代码组织

```
backend/py/src/crystalith/
├── db/
│   └── models.py               # 新增 Session, Message 模型
├── api/
│   ├── sessions.py             # Session CRUD API
│   └── messages.py             # Message API
└── schemas/
    ├── sessions.py             # Session Pydantic 模型
    └── messages.py             # Message Pydantic 模型
```

### 数据库模型

```python
class Session(AsyncSqlATableBase):
    __tablename__ = "sessions"

    id: Mapped[int]
    notebook_id: Mapped[int]  # FK → notebooks.id
    title: Mapped[str | None]
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]

    messages: Mapped[list["Message"]]  # relationship

class Message(AsyncSqlATableBase):
    __tablename__ = "messages"

    id: Mapped[int]
    session_id: Mapped[int]  # FK → sessions.id
    role: Mapped[str]  # user | assistant | system
    content: Mapped[str]
    citations: Mapped[dict | None]  # JSON
    created_at: Mapped[datetime]
```
