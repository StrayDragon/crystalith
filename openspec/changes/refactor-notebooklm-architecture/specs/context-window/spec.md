## ADDED Requirements

### Requirement: Token 计数
系统 MUST准确计算文本的 Token 数量。

#### Scenario: 计算 Token
- **WHEN** 系统处理文本内容
- **THEN** 使用 tiktoken 计算 Token 数量，支持不同模型的编码

### Requirement: 上下文窗口限制
系统 MUST遵守模型的上下文窗口限制。

#### Scenario: 窗口限制
- **WHEN** 构建 LLM 输入
- **THEN** 系统确保总 Token 数不超过配置的最大值

### Requirement: 上下文压缩
系统 MUST支持上下文压缩策略。

#### Scenario: 摘要压缩
- **WHEN** 上下文超过限制
- **THEN** 系统对历史消息进行摘要压缩

#### Scenario: 截断压缩
- **WHEN** 上下文超过限制且摘要不适用
- **THEN** 系统截断最早的消息，保留最近的上下文

### Requirement: 滑动窗口
系统 MUST支持滑动窗口策略管理长对话。

#### Scenario: 滑动窗口
- **WHEN** 会话消息数量增加
- **THEN** 系统保留最近 N 条消息，早期消息移出窗口

### Requirement: 优先级保留
系统 MUST支持按优先级保留上下文内容。

#### Scenario: 优先级保留
- **WHEN** 需要压缩上下文
- **THEN** 系统优先保留：系统提示 > 最近消息 > 检索结果 > 历史消息

### Requirement: 上下文配置
系统 MUST支持配置上下文窗口参数。

#### Scenario: 配置参数
- **WHEN** 用户在配置文件中设置上下文参数
- **THEN** 系统使用配置的 max_tokens、compression_strategy、window_size

### Requirement: 上下文统计
系统 MUST提供上下文使用统计。

#### Scenario: 统计信息
- **WHEN** 生成回答
- **THEN** 系统返回上下文使用统计：总 Token、检索 Token、历史 Token

---

## 技能要求

### 后端实现技能

1. **uv Python 项目管理** (`uv`)
   - Token 计数：`uv add tiktoken`

2. **Python 测试** (`python-testing`)
   - 测试 Token 计数准确性
   - 测试压缩策略
   - 测试滑动窗口

3. **配置管理**
   - 在 Settings 中添加 context_window 配置
   - 支持不同模型的 max_tokens

### 代码组织

```
backend/py/src/crystalith/context/
├── __init__.py
├── counter.py                  # Token 计数器
├── compressor.py               # 上下文压缩器
├── window.py                   # 滑动窗口管理
└── types.py                    # ContextStats 类型
```

### 配置示例

```yaml
# config/app.yaml
context_window:
  max_tokens: 8000              # 最大 Token 数
  compression_strategy: truncate # truncate | summarize
  window_size: 10               # 保留最近 N 条消息
  priority:                     # 压缩优先级（低优先级先压缩）
    - history                   # 历史消息
    - retrieval                 # 检索结果
    - recent                    # 最近消息
    - system                    # 系统提示
```

### ContextStats 类型

```python
@dataclass
class ContextStats:
    total_tokens: int           # 总 Token 数
    system_tokens: int          # 系统提示 Token
    history_tokens: int         # 历史消息 Token
    retrieval_tokens: int       # 检索结果 Token
    query_tokens: int           # 当前查询 Token
    max_tokens: int             # 配置的最大值
    compressed: bool            # 是否进行了压缩
```
