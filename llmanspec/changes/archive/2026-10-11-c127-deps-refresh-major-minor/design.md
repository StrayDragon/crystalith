# Design — 依赖全景刷新（单 change 三批次）

## 决策总纲

| 决策点       | 选择                                                                                                      | 理由                                                                                                                                                                                                          |
| ------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 变更粒度     | 单 change 分批 commit，**不拆多 PR**                                                                      | `@ai-sdk/*` 六件套互 pin `@ai-sdk/provider`、`zod` 贯穿三 workspace——拆开制造大量「半升级态」（c127 前置实验已实证：pin 4.0.9 + lock 解析 4.0.78 → 30 个 TS 错）。批次 commit + 每批 `just qa` 提供等价隔离度 |
| 升级操作方式 | **`bun update <pkg>`**（bun 解析兼容版本并落 lock）；辅助 `bun update <pkg>@<range>` 约束家族锁步         | 用户修正：手改 package.json 再 install 易造 pin/解析图分叉；`bun update` 只动目标子树，与裸 `bun add`（全量重解析漂移根源）语义不同                                                                           |
| 类型墙策略   | V4 类型收敛在 `apps/server/src/ai/` 目录内；消费面（qa handler/outputs generator）只见 `ai/` 导出的窄类型 | 上游 `LanguageModelV*` 每个 minor 都可能动；normalize 函数单点 cast，泄漏面越小升级越便宜                                                                                                                     |
| 红批降级阈值 | 单项 >1 天工时或引入行为回归 → 记 known-issues 裁出                                                       | tailwind 4 是唯一预期超阈项（全样式体系）；其余大版本均为局部                                                                                                                                                 |
| 版本策略遗留 | 本 change 收口后恢复 semver range（`^`）+ lockfile 提交；`@ai-sdk/*` 维持精确 pin                         | 精确 pin 仅用于互锁的 provider 家族（历史事故区）；其余靠 `bun outdated` 例行 + qa 门禁                                                                                                                       |

## Batch Y — cast wall 适配设计

现状（c127 前已勘察）：

```
providers.ts:52 resolveChatModel  ← 唯一 V4 cast 收敛点（三分支: callable/.chat/.languageModel）
middleware.ts ×5                  ← middleware 签名引用 LanguageModel
stream.ts ×2 / qa/handler.ts ×2 / outputs/generator.ts ×2  ← 终端消费
```

适配路径（按上游破坏程度分档）：

1. **纯 minor（类型兼容）**：只动 `package.json` + lock；cast wall 原样。验证 = typecheck + provider mock 测试。
2. **V4 签名小改**（字段增删）：`resolveChatModel` 三分支内点对点补 cast/ narrowing；不改消费面。
3. **V4→V5 breaking**：在 `ai/provider-normalize.ts`（新）落 `normalizeLanguageModel(raw: unknown): OurModel`——把 callable/`.chat()`/`.languageModel()` 探测收进单一函数；`providers.ts` 与消费面全部改走其返回的**本仓自有窄接口**。`middleware.ts` 签名同步。此档出现才新建文件。

回滚边界：每批次独立 commit；Batch Y 若失败 `git revert` 单批即可，不牵连 G/R。

## 验证矩阵（每批必过）

| 门禁                                      | 覆盖                                                          |
| ----------------------------------------- | ------------------------------------------------------------- |
| `bun run typecheck`                       | 类型墙第一信号                                                |
| `just test`（server+shared）              | provider mock / qa / outputs 全链                             |
| `just test-web`                           | Eden treaty / 编辑器栈（platejs）/ Rstest                     |
| `bun scripts/check-provider-deps.ts`      | 注册表↔package.json 漂移（Y 批关键）                          |
| `just check-app-schema`                   | zod→JSON Schema drift（G1 zod 升级关键）+ R7 openapi snapshot |
| `just audit-fallow` + `audit-fallow-arch` | 变更面质量 + 循环依赖（新 import 结构回归）                   |
| `just qa` 整链                            | 收口前最终                                                    |

## Batch R 专项注意

- **tailwind 4**：先 spike `npx @tailwindcss/upgrade` dry-run 评估；涉及 `src/app/tailwind.css` 重写与 `Layer 系统` class 兼容。超阈即裁。
- **gpt-tokenizer 4**：`countTokens` 口径变化影响 QA confidence 阈值链——跑 `apps/server/tests/qa/*` 全套比对数值漂移。
- **zod-to-openapi 9**：`apps/server/tests/openapi-generation.test.ts` 是现成 snapshot 门。
- **msw 3**：只影响 `apps/web/src/test-utils/msw/`，测试基建不动业务。
