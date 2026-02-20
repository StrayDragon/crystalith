## Context

当前结构化输出生成（`OutputGraph` + `pydantic_ai.Agent(output_type=...)`）依赖 Pydantic schema 校验来保证输出结构正确。对云端强模型来说该策略表现稳定，但在本地小模型（例如 Ollama + qwen2.5-coder:1.5b）上更容易出现“几乎正确但略微偏差”的输出形态（例如多余字段、citations 以字符串形式出现、items/bullets 列表元素为字符串等），从而触发 schema 校验失败并直接进入 fallback 输出。

系统已经具备 postprocess（最低内容兜底、citations 清洗、内部字段处理等），因此我们可以将“严格拒绝”调整为“宽容解析 + 后处理归一化”，在不改变最终输出 shape 的前提下显著降低回退概率。

## Goals / Non-Goals

**Goals:**
- 减少本地模型在结构化输出阶段因 schema 校验失败导致的 fallback
- 保持对外输出结构稳定（仍按既有 schema 输出），并继续使用 postprocess 进行归一化与 citations 清洗
- 变更范围尽量局限在核心 output schemas 与对应测试

**Non-Goals:**
- 不引入 constrained decoding / 额外推理引擎
- 不修改插件输出 schema（插件可继续自行选择严格或宽容）
- 不承诺小模型在所有 OutputType 上都能稳定生成高质量内容（仅减少“无谓回退”）

## Decisions

1. **核心输出 schema 采用更宽容的解析策略**
   - 将 `output_schemas.py` 的 `extra="forbid"` 调整为 `extra="ignore"`，避免因额外字段导致整体校验失败
   - 为 `citations` 增加宽容的输入归一化：接受 `str/int/list` 等常见形态并转为 `list[int]`
   - 为 `CitedText` 增加 before-level 的输入归一化：允许直接给字符串（视为 `text`），从而支持 `items=["..."]` / `bullets=["..."]` 这类常见小模型输出

2. **保持输出 JSON Schema 作为主要约束，但接受更宽容的输入**
   - schema 仍然描述期望结构（对象/字段/数组），以便模型尽量输出正确形态
   - 宽容解析仅用于减少由于轻微偏差导致的硬失败

3. **用单元测试锁定宽容解析行为**
   - 增加回归测试覆盖：extra key、citations 字符串、CitedText 直接字符串与列表字符串等输入形态

**Alternatives considered:**
- 在 `Agent.run` 失败时进行“二次生成/修复”或自己解析 raw JSON：实现更重且会引入额外请求开销
- 仅通过增加 retries/改 prompt 改善：对小模型可能仍不稳定，且会扩大时延波动
- 通过配置强制使用更强模型：无法改善“离线/本地”体验

## Risks / Trade-offs

- [风险] 更宽容的解析可能掩盖模型输出错误 → [缓解] postprocess 继续做最低内容兜底；对明显无效输出仍会 fallback；必要时在日志中依靠 `_warnings` 与现有可观测字段定位问题
- [风险] extra 字段被忽略会丢弃模型附加信息 → [缓解] 核心 output shape 不需要这些字段；避免将不受控字段写入 DB/前端
