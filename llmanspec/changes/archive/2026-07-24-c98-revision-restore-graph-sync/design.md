# Design: c98 revision restore graph sync

> **状态**：Apply 锁定 · 全程 **main**
>
> **Locked 2026-07-24**：J1=A · **J2=B** · J3=A · J4=B · J5=A
>
> **J2 裁定**：选 B（回图 `?rid=` 强制 `loadRun`）。比共享 SWR（A）更少耦合；比 BroadcastChannel（C）更少竞态。配合 `markLabRunNeedsReload` 保证 restore 后必刷。

## 恢复流

```
POST …/revisions/:revId/restore
  → GET …/research/:rid          // J1=A 全量
  → markLabRunNeedsReload(nid,rid)
  → 报告页 state 用 GET 结果
返回 /research-lab/:nid?rid=
  → useEdenLabController loadRun（J2=B；consume gate）
  → pullProgress(0)              // J5=A
```

## Fixture（J4=B）

修订切换 / restore 同构：把该轮 `graph` 写入 sessionStorage，返回图谱时 `loadInitial` 读到新图（模拟服务端已恢复）。

## UI（J3=A）

restore 中 `busy` 禁用选择；失败写内联 `actionError`（不依赖 toast 作为唯一通道）。

## 非目标

- 不新增 revisions API
- 不改快照 schema
