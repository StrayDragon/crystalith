## ADDED Requirements

### Requirement: 向量存储抽象接口
系统必须提供 `VectorStore` 抽象接口，定义向量存储的标准操作，支持多种后端实现。

#### Scenario: 定义向量存储接口
- **WHEN** 开发者需要实现新的向量存储后端
- **THEN** 系统提供 `VectorStore` Protocol，包含 `add`、`search`、`remove_source`、`remove_notebook`、`entries` 方法

### Requirement: 内存向量存储
系统必须提供 `InMemoryVectorStore` 实现，用于开发和测试场景。

#### Scenario: 使用内存向量存储
- **WHEN** 配置 `vector_storage.provider` 为 `memory`
- **THEN** 系统使用内存存储向量，重启后数据丢失

### Requirement: SQLite 向量存储
系统必须提供 `SQLiteVectorStore` 实现，支持向量持久化存储。

#### Scenario: 使用 SQLite 向量存储
- **WHEN** 配置 `vector_storage.provider` 为 `sqlite`
- **THEN** 系统使用 sqlite-vss 扩展存储向量，重启后数据保留

#### Scenario: 向量搜索
- **WHEN** 用户提交查询
- **THEN** 系统返回相似度最高的 Top-K 向量条目，包含 chunk_id 和 score

### Requirement: 向量存储配置
系统必须支持通过配置文件选择向量存储后端。

#### Scenario: 配置向量存储
- **WHEN** 用户在 `config/app.yaml` 中设置 `vector_storage.provider`
- **THEN** 系统启动时使用指定的向量存储后端

### Requirement: 向量存储迁移
系统必须提供向量数据迁移工具，支持在不同后端之间迁移数据。

#### Scenario: 从内存迁移到 SQLite
- **WHEN** 用户执行迁移命令
- **THEN** 系统将内存中的向量数据导出并导入到 SQLite 存储

---

## 技能要求

### 后端实现技能

1. **uv Python 项目管理** (`uv`)
   - 新增 sqlite-vss 依赖：`uv add sqlite-vss`
   - 可选 chromadb 依赖：`uv add chromadb --optional`

2. **Python 测试** (`python-testing`)
   - 使用 pytest fixtures 创建临时数据库
   - 测试 add/search/remove 操作
   - 测试跨后端迁移

3. **Ruff 代码质量** (`ruff`)
   - Protocol 定义使用 `typing.Protocol`
   - 类型注解完整

4. **cl-sqlalchemyx**
   - 复用现有的 AsyncDBManager
   - 向量表使用独立的 metadata

### 代码组织

```
backend/py/src/crystalith/vector_storage/
├── __init__.py
├── interfaces.py               # VectorStore Protocol
├── types.py                    # VectorEntry, VectorSearchResult
├── memory.py                   # InMemoryVectorStore
├── sqlite.py                   # SQLiteVectorStore (sqlite-vss)
├── chroma.py                   # ChromaVectorStore (可选)
├── factory.py                  # 根据配置创建实例
└── migration.py                # 迁移工具
```

### 配置示例

```yaml
# config/app.yaml
vector_storage:
  provider: sqlite  # memory | sqlite | chroma
  sqlite:
    path: ./data/vectors.db
  chroma:
    host: localhost
    port: 8000
```
