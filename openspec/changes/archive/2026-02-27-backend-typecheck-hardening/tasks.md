## 1. Typecheck 基线

- [x] 1.1 引入 basedpyright dev 依赖与配置（禁止显式 Any）。
- [x] 1.2 增加 `just typecheck` 入口。

## 2. JSON 边界类型收敛

- [x] 2.1 新增 `JsonValue`/`JsonDict` 并在 cache/DB/payload 边界使用。
- [x] 2.2 修复 Protocol/泛型不变性相关的 type errors。

## 3. 可选依赖与运行时稳健性

- [x] 3.1 对 Playwright 等可选依赖使用延迟导入，避免缺失时 hard fail。

## 4. Secret 泄露面收敛

- [x] 4.1 OpenAI client cache key 使用 SHA256 指纹，不再包含 raw API key。

## 5. Verification

- [x] 5.1 `cd backend/py && uv run basedpyright --level error src`（0 errors）
- [x] 5.2 `cd backend/py && uv run pytest -q`（856 passed；coverage 85.04%）
