# Design — A 组 13 条场景化与锁测

## 逐条方案（现状 → 绑定）

| req  | 现状证据                                                                                               | 测试形态                                                                   |
| ---- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| r250 | `sync.ts buildSyncCandidates`：path map + sizeBytes/modifiedAt 对比 + localeCompare 排序（确定性）     | server 单测：构造 base/current 快照断言 added/updated/missing 与排序       |
| r252 | `source-connectors/router.ts:148` c44 409+hint+pluginDiagnostic                                        | server 集成锁测：不可用 connector → 409 CONNECTOR_UNAVAILABLE              |
| r254 | ready 流程（c30 同步 embed）+ rag 检索路径                                                             | 集成锁测：ingest ready → chunks>0 且检索命中该源                           |
| r310 | `service.ts:333` busy guard（sse busy 事件）+ `:137` v1 对齐 stale 清理（IDLE+errorMessage=null+bool） | server 锁测：busy 事件形状 + 清理语义断言                                  |
| r313 | `useSlidesPreviewSync.ts`（保存→刷新预览目标）                                                         | web Rstest：保存先于预览刷新、目标来自 plugin 声明非硬编码                 |
| r316 | `router.ts serializeSlide:154-163` outputId+generationConfig camelCase                                 | server 锁测：序列化形状（null outputId 亦携带）                            |
| r317 | `service.ts:311-319` done={traceId,slideId}（c51）                                                     | server 锁测：done payload 精确键集，无全量 slide 序列化                    |
| r302 | `MindmapViewer.tsx` collapsed 状态 + 折叠按钮                                                          | web Rstest：渲染→折叠→展开，只读（无编辑入口）                             |
| r303 | `QuizRunner.tsx` 作答状态/resolveCorrect/即时反馈                                                      | web Rstest：作答→反馈→汇总；**预警计分 bug，爆则修**                       |
| r102 | Lab 详情层（ResearchLabPage modal Layer + Desk 挂载）                                                  | web Rstest：打开详情 Desk 仍挂载、Escape/遮罩仅关详情、单实例替换          |
| r148 | 失败合成路径（Lab 报告渲染门控）                                                                       | web Rstest：failed 不渲染启发式报告、重试入口可见；0 证据 completed 仍渲染 |
| r445 | `labLayout.ts`/`applyGraphPatch.ts` conclusion role 处理                                               | web 单测：conclusion 节点不产生可剪枝入口                                  |
| r446 | `LabCanvasSettings.test.tsx`（c119 已建）                                                              | 复验既有断言覆盖面，缺则补（偏好切换零 graph 命令）                        |

## 幻影锚点重锚（报告制）

- r13（architecture-plugin-and-agent）：场景锚从 SKIP 的 `features/qa/知识问答.feature` 重锚到 qa-session-contract 的 stream done 断言（真实执行）。
- r205（output-rendering-and-typing）：SLIDES 拒绝场景重锚到 `tests/generation/generation-types.test.ts` 的 supported 列表断言 + 补 SLIDES 专属 400 分支断言（该分支现无直接测试）。

## 测试边界

全部复用既有 seam：server 集成走 `setupIntegrationEnv`（ai mock + embedder stub 前置），web 走 `@rstest/core` 命名导入 + TestProviders 范式。不新增 harness。
