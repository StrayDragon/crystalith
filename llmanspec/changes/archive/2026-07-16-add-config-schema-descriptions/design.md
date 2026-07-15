# add-config-schema-descriptions — Design Decisions

## 1. i18n 策略：轻量 placeholder vs 全量框架

| 方案                        | 优点                         | 缺点                     |
| --------------------------- | ---------------------------- | ------------------------ |
| **直接硬编码字符串**        | 简单                         | 未来 i18n 要改所有调用点 |
| **自定义 desc() helper** ✅ | 调用点不变，仅改一处 i18n.ts | 额外一层间接             |
| **引入 i18next / Lingui**   | 开箱即用                     | ~20KB 依赖，当前不需要   |

选择 `desc()` helper 的原因：

- 最小侵入：调用点和现在的硬编码字符串几乎一样
- 零依赖：只是一个函数定义
- 未来兼容：`_key` 参数预留翻译键
- 切换成本低：只需改 `i18n.ts` 的实现体

## 2. 为什么 API schema 用 `.openapi()` 而非 `.describe()`

`@asteasolutions/zod-to-openapi` 识别 `.openapi()` 元数据比 `.describe()` 更丰富：

| 元数据      | `.describe()` | `.openapi()` |
| ----------- | :-----------: | :----------: |
| description |      ✅       |      ✅      |
| example     |      ❌       |      ✅      |
| format      |      ❌       |      ✅      |
| deprecated  |      ❌       |      ✅      |

为未来 OpenAPI 优化留空间，API schema 用 `.openapi()`。config schema 用 `.describe()`（因为
JSON Schema 生成器只读 `.describe()`，不读 `.openapi()`）。

## 3. 数据流

```
desc('描述文本')
    │
    ├──→ .describe(desc(...))    → gen-app-schema.ts → config/app.schema.gen.json
    │                               config.ts 的 schema 字段描述
    │
    └──→ .openapi({ description: desc(...), example: ... })
                                  → @asteasolutions/zod-to-openapi → Scalar UI
                                    packages/shared/ 的 API schema 字段描述
```

## 4. 无需修改的文件

- `scripts/gen-env-examples.ts` — 不关心描述（.example 文件的注释已由 env.ts SSOT 生成）
- `scripts/gen-app-schema.ts` — 逻辑不变，schema 输出现自带 `.describe()`
- `.pre-commit-config.yaml` — 无需新 hook（已有 drift 检测）
- `justfile` — 无需新 recipe

## 5. 工作量估算

| 阶段             | 文件数 | 预估字段数 | 性质                            |
| ---------------- | ------ | ---------- | ------------------------------- |
| config.ts schema | 1      | 30         | 机械补充，逐字段写描述          |
| 共享 API schema  | ~17    | ~100+      | 需判断哪些字段在 OpenAPI 中暴露 |
| 总计             | ~18    | 130+       | 主要是文案工作                  |

## 6. 非目标

- 不改动 Schema 结构或校验逻辑
- 不改动 OpenAPI 路由注册（`registerApiDoc` 调用方式不变）
- 不改动 Scalar UI 渲染配置
- 不引入 i18n 运行时依赖
