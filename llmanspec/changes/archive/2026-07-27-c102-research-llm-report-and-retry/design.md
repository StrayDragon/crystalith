# Design: c102 LLM 结案报告 + 换模重试

## 1. 目标与非目标

| 做                                  | 不做（本 change）                       |
| ----------------------------------- | --------------------------------------- |
| LLM 结构化结案；失败 failed + retry | fixture 删除 / demo 搬迁（B）           |
| create/retry `modelId`              | 自适应再拆 / 并行 / revision fork（C*） |
| 节点短综合；无假命中                | workspace slash 增强、`@`               |
| Lab Compose + failed 换模重试 UI    | 报告 token 进 Run SSE（仍禁）           |

## 2. 结案流水线

```text
synthesizeAndComplete(runId)
  → 收集 evidences + 各节点摘要（短综合字段）
  → resolveModel(Run.modelId ?? default chat)
  → generateObject / Output.object → ResearchReport
  → validateAndBindCitations(report, runEvidenceMap)
       · 非法 cite key 剥离
       · 若模型输出了 cite 且剥离后全部非法 → synthesize_failed
       · 0 cite（含 0 证据诚实成稿、有证不引）→ 合法
  → 成功：persist report, status=completed, report_ready
  → 模型调用失败 / synthesize_failed：status=failed, failureReason, 无权威假报告
```

**禁止**：启发式证据 bullet 清单作为 `completed` 成稿。

## 3. 命令口

| 端口                                    | 行为                                                                                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST …/research`                       | body 可选 `modelId`；写入 Run                                                                                                                     |
| `POST …/research/:rid/retry-synthesize` | 仅 `failed`（结案类 reason）可调用；body 可选 `modelId`（覆盖写回）；短窗 `running`→LLM 结案→`completed`\|`failed`；MUST NOT 重跑 decompose/drain |
| GET run                                 | 暴露 `modelId?`、`failureReason?`                                                                                                                 |

非法态（非 failed / 非结案失败）→ `RESEARCH_INVALID_STATE`。

## 4. 节点短综合与 work-unit

```text
runNodeWorkUnit
  → Work tools（retrieve/search）如实写 evidence；无结果 = 空列表（合法）
  → 禁止 pragmatic「假命中」回退
  → 末尾 LLM 短综合 → 写回节点 summary/摘要字段 + phase
  → 模型彻底失败 → conclusionStatus=missing + progress；不中止整 Run
```

## 5. Cite 哲学（锁定）

- 引用 = **充分不必要**：节点/报告可无 cite 仍有结论（归纳整理节点）。
- 禁止：悬空/幻觉 cite；禁止用证据清单冒充报告。
- 不因「有证据却未引用」而 failed。

## 6. Lab UI

- Compose：可选 model 下拉（既有 models 列表 API）；默认空=服务端默认。
- Run `failed` 且 `failureReason` 为结案类：横幅/条展示错误 +「重试结案」+ 换模 → `retry-synthesize`。
- 成功路径报告页不变（仍 GET report SSOT）。

## 7. 测试 seam

- server unit：mock LLM 成功成稿；调用失败→failed；非法 cite→failed；retry 换 modelId 成功；0 证据诚实成稿 completed；节点空证据 + missing。
- web Vitest：Compose 传 modelId；failed 条触发 retry。
- 不强制本 change 扩 e2e @p0（可后续）；既有 stub 路径保持可绿。

## 8. 风险

- 结案成本上升（token）；用 Run.modelId / config 可控。
- failed 与「检索无货但仍 completed 诚实报告」文案需区分，避免用户以为必须 retry。
