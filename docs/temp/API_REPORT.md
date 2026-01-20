# Crystalith API 报告

> 生成时间: 2026-01-20

本报告对比前端实际调用的 API 与后端已实现的 API 列表。

---

## 1. 前端调用的 API 列表

以下 API 由前端 `frontend/web/src/features/workspace/api.ts` 调用：

| 函数名 | HTTP 方法 | 路径 | 说明 |
|--------|----------|------|------|
| `listNotebooks` | GET | `/v1/notebooks` | 获取笔记本列表 |
| `createNotebook` | POST | `/v1/notebooks` | 创建笔记本 |
| `listSources` | GET | `/v1/notebooks/{notebook_id}/sources` | 获取来源列表 |
| `deleteSources` | POST | `/v1/notebooks/{notebook_id}/sources/batch-delete` | 批量删除来源 |
| `uploadSource` | POST | `/v1/notebooks/{notebook_id}/sources` | 上传来源文件 |
| `searchSources` | POST | `/v1/notebooks/{notebook_id}/sources/search` | 搜索来源 |
| `askQuestion` | POST | `/v1/notebooks/{notebook_id}/qa` | 问答请求 |
| `refinePrompt` | POST | `/v1/notebooks/{notebook_id}/refine` | 精炼提示 |
| `listSessions` | GET | `/v1/notebooks/{notebook_id}/sessions` | 获取会话列表 |
| `createSession` | POST | `/v1/notebooks/{notebook_id}/sessions` | 创建会话 |
| `listMessages` | GET | `/v1/sessions/{session_id}/messages` | 获取会话消息 |
| `createSessionSuggestions` | POST | `/v1/sessions/{session_id}/suggestions` | 创建会话建议 |
| `createNotebookSuggestions` | POST | `/v1/notebooks/{notebook_id}/suggestions` | 创建笔记本建议 |
| `createOutput` | POST | `/v1/notebooks/{notebook_id}/outputs/{output_type}` | 创建输出内容 |
| `listOutputs` | GET | `/v1/notebooks/{notebook_id}/outputs` | 获取输出列表 |
| `listWorkspaceTools` | GET | `/v1/workspace/tools` | 获取工作区工具列表 |
| `refineBatch` | POST | `/v1/notebooks/{notebook_id}/refine/batch` | 批量精炼 |

**前端调用总计: 17 个 API**

---

## 2. 后端已实现的 API 列表

### 2.1 Notebooks (笔记本)
> 文件: `backend/py/src/crystalith/api/notebooks.py`
> 前缀: `/v1/notebooks`

| HTTP 方法 | 路径 | 函数名 | 说明 |
|----------|------|--------|------|
| POST | `/v1/notebooks` | `create_notebook` | 创建笔记本 |
| GET | `/v1/notebooks` | `list_notebooks` | 获取笔记本列表 |
| GET | `/v1/notebooks/{notebook_id}` | `get_notebook` | 获取单个笔记本 |
| PATCH | `/v1/notebooks/{notebook_id}` | `update_notebook` | 更新笔记本 |
| DELETE | `/v1/notebooks/{notebook_id}` | `delete_notebook` | 删除笔记本 |

### 2.2 Sources (来源)
> 文件: `backend/py/src/crystalith/api/sources.py`
> 前缀: `/v1/notebooks/{notebook_id}/sources`

| HTTP 方法 | 路径 | 函数名 | 说明 |
|----------|------|--------|------|
| GET | `/v1/notebooks/{notebook_id}/sources` | `list_sources` | 获取来源列表 |
| POST | `/v1/notebooks/{notebook_id}/sources` | `upload_source` | 上传来源文件 |
| POST | `/v1/notebooks/{notebook_id}/sources/search` | `search_sources` | 搜索来源 |
| DELETE | `/v1/notebooks/{notebook_id}/sources/{source_id}` | `delete_source` | 删除单个来源 |
| POST | `/v1/notebooks/{notebook_id}/sources/batch-delete` | `batch_delete_sources` | 批量删除来源 |

### 2.3 Sessions (会话)
> 文件: `backend/py/src/crystalith/api/sessions.py`
> 前缀: `/v1/notebooks/{notebook_id}/sessions`

| HTTP 方法 | 路径 | 函数名 | 说明 |
|----------|------|--------|------|
| POST | `/v1/notebooks/{notebook_id}/sessions` | `create_session` | 创建会话 |
| GET | `/v1/notebooks/{notebook_id}/sessions` | `list_sessions` | 获取会话列表 |
| GET | `/v1/notebooks/{notebook_id}/sessions/{session_id}` | `get_session` | 获取单个会话 |
| PATCH | `/v1/notebooks/{notebook_id}/sessions/{session_id}` | `update_session` | 更新会话 |
| DELETE | `/v1/notebooks/{notebook_id}/sessions/{session_id}` | `delete_session` | 删除会话 |

### 2.4 Messages (消息)
> 文件: `backend/py/src/crystalith/api/messages.py`
> 前缀: `/v1/sessions/{session_id}/messages`

| HTTP 方法 | 路径 | 函数名 | 说明 |
|----------|------|--------|------|
| POST | `/v1/sessions/{session_id}/messages` | `create_message` | 创建消息 |
| GET | `/v1/sessions/{session_id}/messages` | `list_messages` | 获取消息列表 |

### 2.5 QA (问答)
> 文件: `backend/py/src/crystalith/api/qa.py`
> 前缀: `/v1/notebooks/{notebook_id}/qa`

| HTTP 方法 | 路径 | 函数名 | 说明 |
|----------|------|--------|------|
| POST | `/v1/notebooks/{notebook_id}/qa` | `ask_question` | 问答请求 |

### 2.6 Refine (精炼)
> 文件: `backend/py/src/crystalith/api/refine.py`
> 前缀: `/v1/notebooks/{notebook_id}/refine`

| HTTP 方法 | 路径 | 函数名 | 说明 |
|----------|------|--------|------|
| POST | `/v1/notebooks/{notebook_id}/refine` | `refine` | 精炼内容 |
| POST | `/v1/notebooks/{notebook_id}/refine/batch` | `refine_batch` | 批量精炼 |

### 2.7 Outputs (输出)
> 文件: `backend/py/src/crystalith/api/outputs.py`
> 前缀: `/v1/notebooks/{notebook_id}/outputs`

| HTTP 方法 | 路径 | 函数名 | 说明 |
|----------|------|--------|------|
| POST | `/v1/notebooks/{notebook_id}/outputs/{output_type}` | `create_output` | 创建输出 |
| GET | `/v1/notebooks/{notebook_id}/outputs` | `list_outputs` | 获取输出列表 |
| GET | `/v1/notebooks/{notebook_id}/outputs/{output_id}` | `get_output` | 获取单个输出 |

### 2.8 Suggestions (建议)
> 文件: `backend/py/src/crystalith/suggestions/api.py`
> 前缀: `/v1`

| HTTP 方法 | 路径 | 函数名 | 说明 |
|----------|------|--------|------|
| POST | `/v1/notebooks/{notebook_id}/suggestions` | `notebook_suggestions` | 生成笔记本建议 |
| POST | `/v1/sessions/{session_id}/suggestions` | `session_suggestions` | 生成会话建议 |

### 2.9 Tasks (任务)
> 文件: `backend/py/src/crystalith/tasks/api.py`
> 前缀: `/v1`

| HTTP 方法 | 路径 | 函数名 | 说明 |
|----------|------|--------|------|
| GET | `/v1/tasks/{task_id}` | `get_task` | 获取任务状态 |
| GET | `/v1/notebooks/{notebook_id}/tasks` | `list_tasks` | 获取笔记本任务列表 |

### 2.10 Workspace Tools (工作区工具)
> 文件: `backend/py/src/crystalith/api/tools.py`
> 前缀: `/v1/workspace`

| HTTP 方法 | 路径 | 函数名 | 说明 |
|----------|------|--------|------|
| GET | `/v1/workspace/tools` | `list_workspace_tools` | 获取工作区工具列表 |

### 2.11 Analysis (分析)
> 文件: `backend/py/src/crystalith/analysis/api.py`
> 前缀: `/v1/notebooks/{notebook_id}/analysis`

| HTTP 方法 | 路径 | 函数名 | 说明 |
|----------|------|--------|------|
| GET | `/v1/notebooks/{notebook_id}/analysis` | `analyze_notebook` | 分析笔记本 |

### 2.12 Audio Overview (音频概述) - 未实现
> 文件: `backend/py/src/crystalith/audio/api.py`
> 前缀: `/v1/notebooks/{notebook_id}/audio-overview`

| HTTP 方法 | 路径 | 函数名 | 状态 |
|----------|------|--------|------|
| POST | `/v1/notebooks/{notebook_id}/audio-overview` | `create_audio_overview` | **501 Not Implemented** |

### 2.13 Video Overview (视频概述) - 未实现
> 文件: `backend/py/src/crystalith/api/video_overview.py`
> 前缀: `/v1/notebooks/{notebook_id}/video-overview`

| HTTP 方法 | 路径 | 函数名 | 状态 |
|----------|------|--------|------|
| POST | `/v1/notebooks/{notebook_id}/video-overview` | `create_video_overview` | **501 Not Implemented** |

**后端 API 总计: 28 个端点 (其中 2 个未实现)**

---

## 3. 对比分析

### 3.1 前端调用但后端未提供的 API
**无** - 所有前端调用的 API 后端均已实现。

### 3.2 后端提供但前端未调用的 API

| HTTP 方法 | 路径 | 说明 |
|----------|------|------|
| GET | `/v1/notebooks/{notebook_id}` | 获取单个笔记本 |
| PATCH | `/v1/notebooks/{notebook_id}` | 更新笔记本 |
| DELETE | `/v1/notebooks/{notebook_id}` | 删除笔记本 |
| DELETE | `/v1/notebooks/{notebook_id}/sources/{source_id}` | 删除单个来源 |
| GET | `/v1/notebooks/{notebook_id}/sessions/{session_id}` | 获取单个会话 |
| PATCH | `/v1/notebooks/{notebook_id}/sessions/{session_id}` | 更新会话 |
| DELETE | `/v1/notebooks/{notebook_id}/sessions/{session_id}` | 删除会话 |
| POST | `/v1/sessions/{session_id}/messages` | 创建消息 |
| GET | `/v1/notebooks/{notebook_id}/outputs/{output_id}` | 获取单个输出 |
| GET | `/v1/tasks/{task_id}` | 获取任务状态 |
| GET | `/v1/notebooks/{notebook_id}/tasks` | 获取笔记本任务列表 |
| GET | `/v1/notebooks/{notebook_id}/analysis` | 分析笔记本 |
| POST | `/v1/notebooks/{notebook_id}/audio-overview` | 音频概述 (未实现) |
| POST | `/v1/notebooks/{notebook_id}/video-overview` | 视频概述 (未实现) |

**总计: 14 个后端 API 未被前端调用**

### 3.3 统计摘要

| 指标 | 数量 |
|------|------|
| 前端调用的 API | 17 |
| 后端实现的 API | 28 |
| 前端调用且后端支持 | 17 |
| 后端提供但前端未调用 | 11 (功能完整) + 2 (未实现) = 13 |
| 未实现的 API | 2 |

---

## 4. API 路由树

```
/v1
├── /notebooks
│   ├── GET        列表
│   ├── POST       创建
│   └── /{notebook_id}
│       ├── GET        获取
│       ├── PATCH      更新
│       ├── DELETE     删除
│       ├── /sources
│       │   ├── GET           列表
│       │   ├── POST          上传
│       │   ├── /search       POST 搜索
│       │   ├── /batch-delete POST 批量删除
│       │   └── /{source_id}  DELETE 删除
│       ├── /sessions
│       │   ├── GET        列表
│       │   ├── POST       创建
│       │   └── /{session_id}
│       │       ├── GET     获取
│       │       ├── PATCH   更新
│       │       └── DELETE  删除
│       ├── /qa
│       │   └── POST  问答
│       ├── /refine
│       │   ├── POST   精炼
│       │   └── /batch POST 批量精炼
│       ├── /outputs
│       │   ├── GET           列表
│       │   ├── /{output_type} POST 创建
│       │   └── /{output_id}   GET 获取
│       ├── /suggestions
│       │   └── POST  建议
│       ├── /tasks
│       │   └── GET   任务列表
│       ├── /analysis
│       │   └── GET   分析
│       ├── /audio-overview
│       │   └── POST  音频概述 (501)
│       └── /video-overview
│           └── POST  视频概述 (501)
├── /sessions
│   └── /{session_id}
│       ├── /messages
│       │   ├── GET   列表
│       │   └── POST  创建
│       └── /suggestions
│           └── POST  建议
├── /tasks
│   └── /{task_id}
│       └── GET  获取
└── /workspace
    └── /tools
        └── GET  工具列表
```

---

## 5. Output Types (输出类型)

后端支持的输出类型（用于 `/v1/notebooks/{notebook_id}/outputs/{output_type}`）：

| ID | 标签 | 说明 | 色调 |
|----|------|------|------|
| `faq` | 闪卡 | 问答清单 | blue |
| `guide` | 指南 | 学习/行动指南 | green |
| `timeline` | 时间轴 | 关键事件序列 | rose |
| `mindmap` | 思维导图 | 主题层级结构 | indigo |
| `quiz` | 测验 | 知识检验 | teal |
| `briefing` | 报告 | 高层摘要 | amber |

---

## 6. 备注

1. **音频概述** 和 **视频概述** API 已定义路由但返回 501 Not Implemented。
2. 前端主要通过 `api.ts` 集中管理所有 API 调用，使用原生 `fetch` 而非 axios。
3. 后端使用 FastAPI 框架，API 版本前缀为 `/v1`。
4. 所有 API 均支持 JSON 格式请求/响应。
