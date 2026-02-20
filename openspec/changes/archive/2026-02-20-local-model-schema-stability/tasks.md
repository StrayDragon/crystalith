## 1. Lenient output schema parsing

- [x] 1.1 放宽核心 output schemas 的 `extra` 策略（避免额外字段导致 schema 失败）
- [x] 1.2 为 `citations` 与 `CitedText` 增加宽容归一化（支持字符串/混合列表/列表元素为字符串）

## 2. Tests

- [x] 2.1 增加回归单测：覆盖 extra keys、citations 字符串、items/bullets 列表字符串等输入形态

## 3. Validation

- [x] 3.1 运行后端测试并确保覆盖率门槛通过
