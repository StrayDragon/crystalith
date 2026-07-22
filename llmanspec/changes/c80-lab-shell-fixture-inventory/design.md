# Design: c80 Lab shell + xlsx-lib fixture + inventory

## Goals

- Lab = 深研主表面；`xlsx-lib` 写死跑通设计面。
- 产出可执行的 **inventory**，驱动 c81。

## Lab surfaces checklist（盘点必覆盖）

| 表面                                   | Lab 现状       | inventory 列                |
| -------------------------------------- | -------------- | --------------------------- |
| 路由/烧瓶入口                          | 有             | 入口合约                    |
| 图 + chrome（方向/算法/边路径/小地图） | 有             | 是否需 API                  |
| prune/fork 对话框                      | 有             | ↔ POST prune/fork           |
| 节点抽屉 + chat 提案                   | 有             | ↔ node chat SSE + 命令口    |
| M1/确认类                              | Lab 机制       | ↔ confirm                   |
| 报告 Plate + cite aside                | 有             | ↔ report/working/revisions  |
| revisions / CoW                        | sessionStorage | ↔ revisions API             |
| progress / console                     | 有             | ↔ progress events           |
| export / suggested report              | 有             | 是否需 API                  |
| scenario 切换                          | 有             | c80 锁定 xlsx-lib；其它可藏 |

## Port sketch

```
LabSessionPort
  loadFixture(xlsx-lib) |  // c80 only authority
  applyLocalMutation…     // prune/fork/chat accept — local until c82
```

c82 换 `EdenResearchSessionPort`，UI 不换权威语义。

## Inventory 输出

`llmanspec/changes/c80-lab-shell-fixture-inventory/inventory.md`：

- Keep / Gap / Extra / Ambiguous 四表
- 每行：Lab 动作 → HTTP/SSE → 现状（有/缺/形变）→ c81 建议

## Non-Goals

- 真 LLM、真 ResearchRun 写入
- 删 research API
