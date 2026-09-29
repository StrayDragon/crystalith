---
depends_on: []
---

# 顺延可测批：A 组 13 条裸规则场景化 + 幻影锚点重锚

## Why

分组深挖 A 组 13 条（c119 顺延的低风险可测项）全部有真实实现，只差场景与锁测绑定。本批同时清掉幻影锚点审计发现的两处真幻影（r13/r205 的场景锚在 `SKIP_FEATURE_DIRS` 的 BDD 域上，从不执行），并把上个会话承诺的 retired-req-ids 护栏脚本入库（已完成，随本批说明）。

## What Changes

- **server 锁测**（tests/studio/ + tests/source-connectors/ + 集成）：r310（busy 防并发 + stale 清理语义）、r316（序列化含 outputId/generationConfig）、r317（done={traceId,slideId}）、r250（快照差异轻量规则）、r252（不可用 connector 409+hint）、r254（ready⇒chunks+向量可命中）。
- **web Rstest**：r302（Mindmap 折叠/展开只读）、r303（Quiz 作答/即时反馈/汇总——**预警可能爆计分 bug**）、r102（详情层 modal Layer + Desk 保持挂载）、r148（失败合成不渲染启发式报告）、r445（conclusion 节点不做可剪枝入口展示）、r446（画布偏好不发 graph 命令，复验既有 LabCanvasSettings.test）、r313（先保存再刷新预览、宿主不硬编码 Slidev）。
- **specs**：13 条全部补嵌套场景锚定上述测试；r13/r205 场景重锚到真实测试（锁定规则场景文本编辑，报告制）。
- pending 72 → 59。

## Impact

- 行为面零变更（纯测试与 spec 场景绑定）；若 r303 测出计分真 bug，按 c120/c123 惯例当场修复并在本 change 内说明。
