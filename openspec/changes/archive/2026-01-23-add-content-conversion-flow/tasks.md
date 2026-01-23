# 任务清单

## 阶段 1：后端 API 实现

### 1.1 消息/会话转来源 API
**文件**：`backend/py/src/crystalith/api/sessions.py` 或新建 `conversions.py`

**端点**：
```
POST /v1/notebooks/{notebook_id}/sessions/{session_id}/convert-to-source
Body: { "message_ids": [1,2,3] | null }
Response: { "source_id": int, "filename": str, "chunk_count": int }
```

**验证标准**：
- [ ] `message_ids=null` 时，转换整个会话的所有消息
- [ ] `message_ids=[...]` 时，仅转换指定消息
- [ ] 返回的 `source_id` 对应的来源状态为 READY
- [ ] 来源的 `metadata_` 包含 `converted_from_session` 字段
- [ ] 来源可在 RAG 查询中被检索到

### 1.2 消息/会话转输出 API
**文件**：`backend/py/src/crystalith/api/sessions.py` 或 `conversions.py`

**端点**：
```
POST /v1/notebooks/{notebook_id}/sessions/{session_id}/convert-to-output
Body: { "message_ids": [1,2,3] | null, "output_type": "PARAGRAPH" }
Response: OutputRead
```

**验证标准**：
- [ ] 支持的 `output_type`: PARAGRAPH, BULLETS, STRUCTURED
- [ ] 返回的输出包含消息内容
- [ ] 输出的 `content` 包含 `_metadata.converted_from_session`
- [ ] 输出在 `list_outputs` API 中可见

### 1.3 后端单元测试
**文件**：`backend/py/tests/test_conversions.py`

**验证标准**：
- [ ] 测试：空会话返回 400 错误
- [ ] 测试：无效 message_ids 返回 404
- [ ] 测试：会话转来源成功路径
- [ ] 测试：消息转输出成功路径
- [ ] 测试：超长内容正确分块

---

## 阶段 2：前端 SDK 更新

### 2.1 更新 API 客户端
**文件**：
- `frontend/web/src/api/client.ts`
- `frontend/web/src/features/workspace/api.ts`

**新增方法**：
```typescript
convertSessionToSource(notebookId, sessionId, messageIds?: number[])
convertSessionToOutput(notebookId, sessionId, outputType, messageIds?: number[])
```

**验证标准**：
- [ ] TypeScript 类型正确定义
- [ ] 方法在 `api.ts` 中正确导出
- [ ] 错误处理包含 HTTP 状态码

---

## 阶段 3：UI 修复与实现

### 3.1 修复 StudioPanel 笔记项交互
**文件**：`frontend/web/src/features/workspace/components/StudioPanel.tsx`

**问题**：用户反馈按钮点不到

**修复点**：
- [ ] 检查 `<button>` 和 `<Menu>` 的 DOM 层级和 z-index
- [ ] 确保 MenuHandler 的 IconButton 有足够的点击区域 (min 24x24px)
- [ ] 验证 `group-hover:opacity-100` 样式正确应用
- [ ] 测试：鼠标悬停显示菜单按钮
- [ ] 测试：点击菜单按钮打开菜单（不触发笔记详情）
- [ ] 测试：点击笔记主区域打开详情（不触发菜单）

### 3.2 ChatPanel 消息转换菜单
**文件**：`frontend/web/src/features/workspace/components/ChatPanel.tsx`

**新增 UI**：
```
[消息内容...]
              [⋮] ← 悬停显示
                  ┌─────────────┐
                  │ 复制内容    │
                  │ 转为笔记  ▶ │ → [段落/要点]
                  │ 转为来源    │
                  └─────────────┘
```

**验证标准**：
- [ ] 仅 assistant 消息显示转换选项
- [ ] 悬停时显示更多操作按钮
- [ ] 点击"转为来源"调用 API 并显示结果
- [ ] 点击"转为笔记"展开子菜单选择类型
- [ ] 转换过程显示加载状态

### 3.3 useChat hook 转换方法
**文件**：`frontend/web/src/features/workspace/hooks/useChat.ts`

**新增方法**：
```typescript
convertMessageToSource(messageId: number): Promise<void>
convertMessageToOutput(messageId: number, type: OutputTypeId): Promise<void>
```

**验证标准**：
- [ ] 方法调用正确的 API 端点
- [ ] 成功后触发 sources/outputs 列表刷新
- [ ] 错误时设置 `state.errors.send`
- [ ] 返回 hook 中导出新方法

### 3.4 转换状态反馈
**文件**：ChatPanel.tsx, StudioPanel.tsx

**验证标准**：
- [ ] 转换中显示 Spinner
- [ ] 成功显示 toast 通知（可使用 window.alert 作为 MVP）
- [ ] 失败显示错误信息

---

## 阶段 4：集成验证

### 4.1 端到端流程测试
**手动测试清单**：
- [ ] 发送对话消息 → 转为来源 → 新问题使用该来源被检索
- [ ] 发送对话消息 → 转为段落笔记 → Studio 面板显示
- [ ] Studio 笔记 → 转为来源（已有功能确认可用）
- [ ] 修复后的 StudioPanel 菜单正常工作

### 4.2 边界情况测试
- [ ] 空消息处理
- [ ] 超长消息处理（> 10000 字符）
- [ ] 演示模式下禁用转换功能
- [ ] 无 activeNotebookId 时禁用转换

---

## 验收标准汇总

| 功能 | 验收标准 |
|------|---------|
| 对话→来源 | API 返回 source_id，来源可被 RAG 检索 |
| 对话→笔记 | API 返回 output，Studio 面板显示 |
| UI 修复 | StudioPanel 菜单按钮可正常点击 |
| ChatPanel 菜单 | 消息悬停显示转换选项 |
| 状态反馈 | 转换过程有加载指示和结果通知 |
