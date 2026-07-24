# Design: c99 workspace chat deep research embed

> **状态**：薄设计 · Apply 在 `feat/c99-workspace-chat-deep-research-embed`

## 命令面（最小）

| 触发                   | 行为                                           |
| ---------------------- | ---------------------------------------------- |
| `/research` 或 `/深研` | 打开 `/research-lab/:nid` Compose              |
| `/research <topic>`    | Eden `createResearchRun` 或 Compose 预填 topic |
| `@research` / Run 选取 | 打开 Lab `?rid=`                               |

实现 MAY 先支持 slash 再扩展 `@` 补全；MUST 文档化实际语法。

## 主入口不变

烧瓶、`researchLabEntry`、Lab 任务抽屉保持并列；chat 命令注册为 **辅助** tier。

## 非目标

- 不取代 Compose 字段校验（depth/sources）
- 不新增 HTTP API
