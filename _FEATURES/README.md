# Crystalith 功能盘点文档

本目录为 **功能清单（Feature Inventory）**，供清理、裁剪、合并决策使用。
**以当前代码为准**；条目 `NOTE` 与 [`MATRIX.md`](MATRIX.md) / [`API-ALIGNMENT-REPORT.md`](API-ALIGNMENT-REPORT.md) 对齐。

## 如何使用

1. [`USER/`](USER/)（前端 UI）与 [`SERVER/`](SERVER/)（后端 API）
2. [`MATRIX.md`](MATRIX.md) 用户功能 ↔ Server 路由
3. 在 `> NOTE:` 填写保留 / 删除 / 合并等结论

## 目录结构

| 路径                                                 | 内容                                   |
| ---------------------------------------------------- | -------------------------------------- |
| [`USER/`](USER/)                                     | UI 功能条目                            |
| [`SERVER/`](SERVER/)                                 | API / 能力条目（含 **已移除** 归档页） |
| [`MATRIX.md`](MATRIX.md)                             | 对照表                                 |
| [`API-ALIGNMENT-REPORT.md`](API-ALIGNMENT-REPORT.md) | FE↔BE 对齐审计                         |

## 规模摘要

| 维度                  | 约数                                                                             |
| --------------------- | -------------------------------------------------------------------------------- |
| 用户 UI 主路径        | ~88                                                                              |
| Server HTTP（c73 后） | ~100（原 ~128，已剪死面）                                                        |
| c73 已移除 HTTP       | refine / tasks / eval / strategies HTTP / outputs/types / qa/presets / citations |

## 已移除功能

| 功能                           | 日期       | 说明                                                                                                                                  |
| ------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 知识图谱 / `POST /v2/analysis` | 2026-07-17 | 价值低；前后端+spec 已删                                                                                                              |
| 孤儿前端 UI 存根批次           | 2026-07-17 | RefinePanel 等；`useTasks`                                                                                                            |
| **c73 死 HTTP 整批**           | 2026-07-20 | refine*、tasks*+TaskQueue、eval*、strategies HTTP、`outputs/types`、`qa/presets`、citations HTTP；见 SERVER/10–14 与 MATRIX `removed` |

已关闭产品缺口（2026-07-20）：connector unbind UI；research `modify` 接线；ModelSelector `role`（M4–M6）。详见 [`API-ALIGNMENT-REPORT.md`](API-ALIGNMENT-REPORT.md)。
愿景债：`background-jobs-and-task-runtime` 已改为 c73 退役约束；`structural-refinement-*` 仅保留 research 可靠性条款（局部改良 MUST 已删）。

## 「待盘点」含义

`MATRIX.md` / `USER` / `SERVER` 条目里的 **「待盘点」** 表示：该行尚未做产品级保留/删除/合并结论，**不是**「功能未实现」或「API 缺口」。

- API-alignment MEDIUM 产品缺口 **M4–M6 + connector unbind** 已于 **2026-07-20 CLOSED**（见 alignment report）。
- MATRIX **逐行盘点**刻意 **deferred**：不要把全表「待盘点」批量改成 Yes —— 那是假盘点，不是活缺口清单。

## 相关代码

- `apps/web/src/features/workspace/`
- `apps/server/src/features/`
- `packages/shared/src/schemas/`
