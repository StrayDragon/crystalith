## Why

`ask_question` 与 `ask_question_stream` 已共享检索流水线，但“回答落库 + 完成元信息构造”仍存在重复逻辑。
重复代码提高了维护成本，也增加了两条路径行为漂移的风险。

## What Changes

- 在 QA API 层抽取共享的完成阶段辅助函数（持久化、context stats、done payload 组装）。
- 让非流式与流式路径都复用同一套完成逻辑，减少重复分支。
- 保持外部响应协议不变（HTTP response 与 SSE event 结构不变）。

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `rag-qa`: 强化流式/非流式 QA 在完成阶段的一致性实现，降低重复逻辑。

## Impact

- 受影响代码：
  - `backend/py/src/crystalith/features/qa/api.py`
  - `backend/py/tests/features/qa/test_qa_api.py`（回归验证复用路径）
- 对外 API 不变。
