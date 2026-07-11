# c45 Design — QA ContextStats 契约 + citation 兜底 + presets

## v1 行为契约 (SSOT: `backend/py/.../qa/` + `shared/context/types.py`)

### ContextStats 字段 (context/types.py:11-18)

```python
class ContextStats:
    total_tokens: int
    system_tokens: int
    history_tokens: int
    retrieval_tokens: int
    query_tokens: int
    max_tokens: int
    compressed: bool
```

v2 根因: `retrieve-and-judge.ts:65-72` 用 `total`/`system`/...（无 `_tokens`）+ 丢 `compressed`。

### _ensure_inline_citations (api.py:107-112)

```python
def _ensure_inline_citations(answer, citations):
    if not citations: return answer
    if "[" in answer and "]" in answer: return answer
    return f"{answer} [1]"
```

### low_similarity citations (service.py:455-464)

v1: low_similarity → `citations=[]`（空）。
v2 根因: `retrieve-and-judge.ts:223` 传入实际 citations。

### /prompt: 指令 (presets.py:9-30)

v1: 从 question 解析 `/prompt:<preset>` 前缀。
v2: 只接受 body `preset` 字段。

### stats preset (presets.py:33-99)

STATS_SYSTEM_PROMPT + StatsChart/StatsTable schema + 专用 generateObject 路径。

### context window 压缩 (service.py:254-271 + window.py)

`ContextWindow` 压缩历史 → `compressed=true`。

## v2 对齐方案

### ContextStats 字段

```ts
interface ContextStats {
  total_tokens: number;
  system_tokens: number;
  history_tokens: number;
  retrieval_tokens: number;
  query_tokens: number;
  max_tokens: number;
  compressed: boolean;
}
```

### inline citation 兜底

```ts
function ensureInlineCitations(answer: string, citations: Citation[]): string {
  if (!citations.length) return answer;
  if (answer.includes('[') && answer.includes(']')) return answer;
  return `${answer} [1]`;
}
```

### /prompt: 解析

```ts
const match = question.match(/^\/prompt:(\w+)\s+/);
if (match) {
  preset = match[1];
  question = question.slice(match[0].length);
}
```

### refine chunk_index 决策

统一 1-based（已在 commit 996e2a88 修复）。理由：v1 batch 路径用 1-based（`api.py:295`），v1 worker 单格式 0-based 是 v1 内部不一致；1-based 对前端更直观（用户看到的 chunk 编号从 1 开始）。文档化此决策。

## 不做的事

- 不改 QA 检索/判定核心逻辑（c36 已对齐）
- 不加 client-disconnect 处理（P2，后置）
