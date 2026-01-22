# 技术设计：内容转换流程

## Context

Crystalith 是一个知识管理工具，核心概念包括：
- **来源 (Source)**：用户上传的文档，被分块并嵌入向量存储，用于 RAG 检索
- **对话 (Session/Message)**：用户与 AI 的问答交互
- **Studio 笔记 (Output)**：AI 生成的结构化输出（思维导图、FAQ、时间线等）

当前状态：
- ✅ 来源上传和处理完整
- ✅ 对话和 RAG 问答完整
- ✅ Studio 笔记生成完整
- ✅ 笔记 → 来源转换已实现
- ❌ 对话 → 笔记/来源转换未实现

## Goals / Non-Goals

### Goals
1. 实现对话内容到笔记的转换
2. 实现对话内容到来源的转换
3. 修复 StudioPanel UI 交互问题
4. 保持代码简洁，复用现有基础设施

### Non-Goals
- 不实现来源的逆向转换（来源是最终形态）
- 不实现复杂的内容合并/编辑功能
- 不实现跨笔记本的内容转移

## Decisions

### 决策 1：API 设计模式

**选择**：在现有路由模块中添加转换端点，而非创建独立的 `conversions.py`

**理由**：
- 转换逻辑与现有资源紧密相关
- 避免过度模块化增加复杂性
- 符合现有 REST 风格（资源/动作）

**API 设计**：
```
# 会话/消息转来源
POST /v1/notebooks/{notebook_id}/sessions/{session_id}/convert-to-source
Body: { "message_ids": [1,2,3] | null }  # null 表示整个会话

# 会话/消息转输出
POST /v1/notebooks/{notebook_id}/sessions/{session_id}/convert-to-output
Body: { "message_ids": [1,2,3] | null, "output_type": "PARAGRAPH" }
```

**备选方案**：
- 独立 `/v1/notebooks/{id}/conversions` 端点：增加复杂性
- GraphQL mutation：不符合现有架构

### 决策 2：内容提取策略

**选择**：直接提取消息文本，可选使用 AI 优化

**实现**：
```python
def extract_conversation_text(messages: list[Message], format: str = "raw") -> str:
    """
    format:
    - raw: 直接拼接消息
    - markdown: 添加角色标记和格式
    - summary: 使用 AI 生成摘要（转输出时可选）
    """
    parts = []
    for msg in messages:
        if format == "raw":
            parts.append(msg.content)
        elif format == "markdown":
            role_label = "用户" if msg.role == "user" else "助手"
            parts.append(f"**{role_label}**:\n{msg.content}")
    return "\n\n".join(parts)
```

### 决策 3：元数据追踪

**选择**：在目标对象的 `metadata_` 字段中记录转换来源

**Schema**：
```python
# Source.metadata_ 示例
{
    "converted_from_session": 123,
    "converted_from_messages": [1, 2, 3],  # 可选
    "conversion_timestamp": "2025-01-23T12:00:00Z",
    "word_count": 500,
}

# Output.content 示例（现有字段复用）
{
    "title": "会话摘要",
    "text": "...",
    "_metadata": {
        "converted_from_session": 123,
    }
}
```

### 决策 4：前端状态管理

**选择**：在现有 hooks 中添加转换方法，而非创建新 hook

**理由**：
- 转换操作与现有资源管理紧密相关
- 避免状态分散
- 复用现有的 SWR 缓存刷新逻辑

**实现位置**：
- `useChat.ts`：添加 `convertMessageTo*` 方法
- `useSources.ts`：添加 `convertSessionToSource` 方法（复用现有 mutate）

## Risks / Trade-offs

### 风险 1：大量内容转换性能
**问题**：长对话转换可能导致处理时间过长
**缓解**：
- 限制单次转换的消息数量（建议 < 50 条）
- 大量内容使用后台任务队列（现有 task_queue 基础设施）

### 风险 2：引用信息丢失
**问题**：对话中的引用在转换后可能失去关联
**缓解**：
- 在转换的内容中保留引用标记文本
- 在元数据中记录原始引用的 chunk_ids

### 风险 3：重复内容膨胀
**问题**：用户可能多次转换相同内容
**缓解**：
- 允许重复（用户可能有意创建不同版本）
- 在 UI 中显示"已转换"提示（可选，后续迭代）

## Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   对话      │────►│  Studio     │────►│   来源      │
│  Session    │     │  笔记       │     │  Source     │
│  Message    │     │  Output     │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
      │                                       ▲
      │                                       │
      └───────────────────────────────────────┘
           直接转换（跳过笔记）
```

## UI 设计要点

### ChatPanel 消息操作菜单
```
[消息内容...]
                    ┌─────────────────┐
              [⋮]  │ 复制内容        │
                    │ ─────────────── │
                    │ 转为笔记    ▶   │ ─► [段落/要点/结构化...]
                    │ 转为来源        │
                    └─────────────────┘
```

### StudioPanel 修复重点
- 确保 `<button>` 和 `<MenuHandler>` 的点击区域不重叠
- 检查 `group-hover` 状态是否正确触发
- 验证移动端 touch 事件处理

## Migration Plan

无需数据迁移，纯功能添加：
1. 部署后端 API
2. 更新前端 SDK
3. 部署前端 UI 更新
4. 验证功能正常

## Open Questions

1. 是否需要在来源列表中标识"来自对话"的来源？（建议：显示不同图标）
2. 转换时是否需要 AI 处理优化内容？（建议：可选，默认关闭）
3. 是否支持批量选择多条消息转换？（建议：第一版支持，增加灵活性）
