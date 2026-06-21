# 08 — Elysia vs Hono（Web 框架选型）

> 两者都是优秀的 TS Web 框架，**都能跑在 Bun 上**，但定位和取舍不同。本文基于实测包信息 + 文档对比，给出 crystalith 场景的选型建议。

## 结论速览

| 你的优先级 | 推荐 |
|------|------|
| **端到端类型推断 + Bun 原生优化 + 减少胶水**（前端 RPC 免生成） | **Elysia** ★ |
| **跨 runtime 可移植 + 生态最广 + 稳定成熟 + 更简单的心智模型** | **Hono** |
| 想要两者长处 | Elysia 后端 + 必要时混用（两者 API 风格接近） |

**crystalith 推荐：Elysia**。理由：① 已定 Bun runtime，Elysia 是 Bun-first，性能/体验最优；② `@elysiajs/eden` 类型安全 RPC 可**干掉整个 OpenAPI 生成链路**（当前 `@hey-api/openapi-ts` 那套）；③ 与 pi 生态同属"较新但活跃"的范畴，风格统一。

**退路**：若 P1 阶段踩到 Elysia 的坑（罕见，但它 API 变动较多），切 Hono 成本低——两者都是 `.get()/.post()` + 中间件模式，迁移机械。

---

## 一、基本面对比（实测包元数据）

| 维度 | **Elysia** | **Hono** |
|------|------|------|
| 版本（2026-06） | 1.4.29 | 4.12.26 |
| License | MIT | MIT |
| 直接依赖数 | 4（cookie, memoirist, exact-mirror, fast-decode-uri-component） | **0（zero-dep）** |
| unpackedSize | 1.1 MB | 1.4 MB |
| GitHub Stars | 18.5k | 31.0k |
| Open Issues | 344 | 371 |
| 最近 push | 2026-06-21（5天前） | 2026-06-18（4天前） |
| 维护活跃度 | 高（681 版本，高频迭代） | 高（433 版本，稳） |
| 定位 slogan | "Ergonomic Framework for Human" | "Web framework built on Web Standards" |
| 关键词 | `bun, http, web, server` | `hono, cloudflare, workers, deno, bun, lambda, nodejs` |
| 主战场 | **Bun** | 多 runtime（Cloudflare/Deno/Bun/Node/Lambda） |

> Elysia 直接依赖 4 个（很薄），Hono 是 **零依赖**（极致克制）。两者都很轻。

## 二、能力逐项对比

### 1. 类型安全（核心差异）

| | Elysia | Hono |
|--|--------|------|
| 路径参数 | 端到端推断，无需手动泛型 | 需 `c.req.param()` 或 Zod 验证 |
| Body/Query 校验 | 内建 schema，**自动推断返回类型** | 需手接 `zValidator` / `@hono/zod-openapi` |
| 响应类型 | 自动推断 | 需 `c.json<T>()` 或 ResTspec |
| **前后端类型共享** | ★ **`@elysiajs/eden` RPC**（前端 import 类型即用，免生成） | `hono/client`（也类型安全，但需导出 app 类型） |

**对 crystalith 的关键影响**：当前前端用 `@hey-api/openapi-ts` 从后端 OpenAPI 生成客户端（见 `frontend/web/package.json` 的 `api:sync` 脚本链路 + `src/api/generated/`）。**Elysia + eden 可整条砍掉**：

```
当前: backend OpenAPI → openapi-ts generate → frontend import generated client
Elysia: frontend import { treaty } from '@elysiajs/eden' + app → 直接类型安全 RPC
```

Hono 的 `hono/client` 也能做到（需 `export type App = typeof app`），体验接近但需多一步类型导出。

### 2. Bun 集成度

| | Elysia | Hono |
|--|--------|------|
| runtime 定位 | **Bun-first**（专为 Bun 设计） | runtime-agnostic |
| bun:sqlite 等内建 | 深度配合 | 支持 |
| 文件路由/工具链 | 有 `@elysiajs/*` 配套 | 通用插件 |
| 性能（Bun 上） | 极高（Bun 优化的 hot path） | 高（接近） |

**Elysia 在 Bun 上有主场优势**。Hono 虽然也支持 Bun 且性能很好，但它的抽象要兼容多 runtime，偶尔有"通用"带来的间接成本。

### 3. OpenAPI / Swagger

| | Elysia | Hono |
|--|--------|------|
| 自动 OpenAPI | 内建（schema 推断出文档） | `@hono/zod-openapi`（1.4.0）+ `@hono/swagger-ui`（0.6.1）|
| 所需胶水 | 几乎零 | 需 Zod 配合 |

**注意**：如果用 Elysia eden RPC，前端不再需要 OpenAPI；但若想保留 OpenAPI 给外部消费者（如 SDK 用户，若裁剪后还有），两者都能产出。

### 4. 中间件 / 生态

| | Elysia | Hono |
|--|--------|------|
| 中间件风格 | 函数组合 + lifecycle hooks | 标准 `(c, next) =>` |
| 插件生态 | `@elysiajs/*`（JWT/cors/html/swagger/eden/...） | `@hono/*`（更广：zod-openapi/graphql/firebase/auth0/...） |
| 生态规模 | 中（Bun 圈内主导） | **大**（跨 runtime，工业部署验证多） |
| 心智模型 | "魔法推断"为主，学习曲线略陡 | 标准 Web API（Request/Response），**心智简单** |

### 5. 稳定性与升级

| | Elysia | Hono |
|--|--------|------|
| 版本节奏 | 高频（681 版本，含 exp/beta/rc 多通道） | 稳（433 版本，4.x 主线）|
| 破坏性变更风险 | **较高**（1.x 仍在快速演进，API 偶有调整） | 低（4.x 承诺兼容） |
| issue 响应 | 活跃（作者 saltyaom 主导） | 活跃（核心团队 + 大社区） |

**Elysia 的主要风险点**：迭代快、偶尔有破坏性变更或推断 edge case。**Hono 的主要优势**：成熟、稳、跨 runtime 保险。

## 三、对 crystalith 的具体影响

### 前端 API 层重写

| 当前 | Elysia 方案 | Hono 方案 |
|------|------|------|
| `frontend/web/src/api/generated/*`（hey-api 生成） | **删除整个目录**，改用 eden treaty | 保留生成或改 hono/client |
| `pnpm run api:sync`（fetch + generate 两步） | **删除脚本** | 改为类型 export |
| `openapi.gen.json` | 仅保留用于外部/SDK（可选） | 同左 |

### 后端 router 迁移

crystalith 当前 FastAPI 的 `APIRouter` + 18 个 feature router 模式，两者都能直接映射：

```typescript
// Elysia（推断 body/resp 类型，前端自动获得）
import { Elysia, t } from "elysia";
new Elysia()
  .post("/v1/notebooks", ({ body }) => create(body), {
    body: t.Object({ title: t.String() }),
    response: t.Object({ id: t.Number(), title: t.String() }),
  })

// Hono（Zod 校验，需 zValidator）
import { Hono } from "hono";
import { zValidator } from "@hono/zod-openapi";
const app = new Hono()
  .post("/v1/notebooks",
    zValidator("json", z.object({ title: z.string() })),
    (c) => c.json({ id: 1, title: c.req.valid("json").title })
  )
```

### 与 pi 生态的搭配

- pi 自己用 **Hono**（pi 的 RPC mode 基于 Web 标准）。若选 Hono，与 pi 内部一致。
- 但 pi 是独立进程/SDK 调用，不强制后端框架选型。两者都兼容。

## 四、决策矩阵

| 因素 | 权重 | Elysia | Hono |
|------|------|------|------|
| Bun 原生体验 | 高 | ★★★ | ★★ |
| 类型安全 + 干掉生成链路 | 高 | ★★★（eden） | ★★（client） |
| 心智简单/稳 | 中 | ★★ | ★★★ |
| 生态广度 | 低（桌面 app 不需要那么多） | ★★ | ★★★ |
| 与 pi 一致 | 低 | ★★ | ★★★ |
| 文档/示例丰富 | 中 | ★★ | ★★★ |
| **加权** | | **推荐** | 备选 |

## 五、最终建议

1. **主选 Elysia**。Bun-first + eden RPC + 内建校验，最大化 crystalith 重写的"减负"价值（砍掉 OpenAPI 生成链路）。
2. **锁定版本 + 关注 CHANGELOG**，Elysia 迭代快，用精确版本号（如 `1.4.29`）而非 `latest`。
3. **设一道退路**：后端 router 用薄封装，核心逻辑不依赖框架特性，万一 Elysia 出问题可平迁 Hono。
4. **若 P1 阶段团队反馈 Elysia 推断有坑** → 切 Hono（成本：router 重写，量不大；逻辑层零改动）。

## 相关文档
- [02-target-stack-bun.md](./02-target-stack-bun.md) — Bun 技术栈（本文细化其中 Web 框架选型）
- [06-pi-runtime-integration.md](./06-pi-runtime-integration.md) — pi 用 Hono，与本文决策参考
