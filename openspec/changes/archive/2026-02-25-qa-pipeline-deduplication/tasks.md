## 1. QA API 去重

- [x] 1.1 在 `qa/api.py` 抽取共享 helper（context stats、消息持久化、完成元信息构造）。
- [x] 1.2 让 `ask_question` 与 `ask_question_stream` 复用共享 helper，保持响应协议不变。

## 2. 验证

- [x] 2.1 运行 QA 定向测试并做全量回归验证（`cd backend/py && uv run pytest tests/features/qa/test_qa_api.py -v`，随后 `cd backend/py && just test`）。

## 验证记录

- `cd backend/py && uv run pytest tests/features/qa/test_qa_api.py -v` → 用例全通过，但因全局 coverage gate（85%）触发失败。
- `cd backend/py && just test` → 通过（375 passed，coverage 85.35%）。
