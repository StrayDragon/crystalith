# Design: c99 workspace chat deep research embed

> **状态**：Apply 锁定 · 全程 **main**
>
> **Locked 2026-07-24**：K1=B · K2=A · K3=A · **K4=slash-only**（不做 `@`；深链用 `/research-open <rid>`）· K5=A · K6=A+C

## 命令面

| 触发                                  | 行为                                       |
| ------------------------------------- | ------------------------------------------ |
| `/research` · `/深研`                 | 打开 Lab Compose（不创建 Run）             |
| `/research <topic>` · `/深研 <topic>` | 打开 Lab Compose 并预填 topic（`?topic=`） |
| `/research-open <rid>`                | 打开 Lab `?rid=`                           |

注册：**扩展** `GET /v2/commands`，`kind: 'nav'`（K1=B）。执行：chat **发送时吞掉**（K5=A），不进 QA。

## Fixture（K6=A）

命令仍导航 `/research-lab/:nid`；fixture 模式照旧读 session / `?topic=`。

## 文档（K6=C）

`apps/web/AGENTS.md` 列出实际 slash 语法；标注 chat 为辅助入口。

## 非目标

- 不引入 `@` 提及菜单
- 不在 slash 路径立刻 `createResearchRun`（K2/K3=A）
- 不新增 research HTTP API
