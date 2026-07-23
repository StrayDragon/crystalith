# Design: c82 wire Lab → Eden ResearchRun

## Architecture

```
Compose / 任务抽屉 / Lab 图·报告
    ↓ LabSessionPort
EdenResearchSessionPort  →  treaty<App>  →  /v2/notebooks/:nid/research*
    ↑ shared Research* types / ErrorEnvelope
```

Fixture / `demoResearchTasks` 仅在 `CL_LAB_FIXTURE=1`（或等价）启用。

## Mapping

| Lab / 产品表面                    | API                                          |
| --------------------------------- | -------------------------------------------- |
| Compose 提交                      | `POST …/research`                            |
| 任务抽屉（头像旁 + Lab 顶栏最右） | `GET …/research`（+ status/摘要若 c81 落地） |
| badge 进行中                      | list 客户端计数（或 c81 count）              |
| 切换任务进作业台                  | `GET …/:rid` + `GET …/stream`                |
| 图更新                            | stream `graph_patch`                         |
| prune/fork                        | `POST nodes/…`                               |
| chat accept                       | chat SSE → 命令口                            |
| revisions                         | revisions CRUD/restore                       |
| report edit                       | report working                               |
| progress                          | `GET progress`                               |

对话 `@`/`/`：**不在本 change**（延后）。

## Guardrails

- MUST NOT 平行 Zod DTO 文件
- MUST NOT 本地 timer / sessionStorage 任务列表冒充 Run 权威（默认路径）
- MUST NOT 删除 research API
- MUST NOT 实现对话 `@`/`/` 深研嵌入
- 任务抽屉双入口 UI 保持；仅换数据源

## Testing

- Vitest：port 在 mock fetch 下发 create/list/stream 正确路径
- e2e：任务抽屉打开/切换；Compose 创建后 badge（可 mock）
- server research 测保持绿（回归）
