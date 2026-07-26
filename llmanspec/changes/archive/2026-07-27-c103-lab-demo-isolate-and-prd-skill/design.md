# Design: c103 Lab demo 隔离 + cl-prd-demo skill

## 1. 目标

| 做                                     | 不做                             |
| -------------------------------------- | -------------------------------- |
| 产品 `/research-lab` 纯 Eden           | 抽 `LabSessionPort`（Follow-up） |
| demo → `/demo/research-lab` + 独立目录 | C1–C3 编排                       |
| `VITE_LAB_DEMO` / DEV 才挂 demo 路由   | 删 e2e stub                      |
| `cl-prd-demo` skill 骨架               | 实现完整 Port 抽象               |

## 2. 目录与路由

```text
apps/web/src/features/
  research-lab/          # 产品：Eden only
  research-lab-demo/     # 演示：fake + fixture controller + Demo pages
```

| 路径                             | 条件                       | 实现                   |
| -------------------------------- | -------------------------- | ---------------------- |
| `/research-lab/:nid`             | 始终                       | Eden `ResearchLabPage` |
| `/research-lab/:nid/report`      | 始终                       | Eden report            |
| `/demo/research-lab/:nid`        | DEV \|\| `VITE_LAB_DEMO=1` | Demo page + fixture    |
| `/demo/research-lab/:nid/report` | 同上                       | Demo report            |

废弃：`VITE_LAB_FIXTURE` 作为产品路径开关（可映射为「请用 demo 路由」文档说明，代码 MUST NOT 再读它切产品权威）。

## 3. 产品页净化

- `ResearchLabPage`：删除 `isLabFixtureMode` 分支与 `FixtureResearchLab*`。
- 展示组件可留在 `research-lab/`（图、抽屉、Compose）；demo 通过相对 import 复用**无 controller 联合**的展示件，或复制最小壳——优先复用纯展示、禁止产品再 `as LabController | Eden`。
- Workspace 烧瓶 / slash：仅 `navigateToResearchLab`（产品前缀）。

## 4. cl-prd-demo skill（骨架）

路径：`.agents/skills/cl-prd-demo/SKILL.md`

固定流程（文档）：

1. 在 `/demo/...`（或未来 demo 面）用假跑锁定交互与文案
2. 产出 inventory（Keep/Gap vs 真 API）
3. propose Eden 接线 change（命令口 SSOT）
4. apply → verify → 可选删/收 demo

不强制本 change 实现自动化脚本。

## 5. 测试

- Vitest：产品路径在未设 demo 时无 fixture 分支；`parseResearchLabPath` 不匹配 `/demo/...`；demo parser 覆盖 `/demo/research-lab/:nid`
- 既有 Eden Vitest / e2e `@p0` 保持绿
- fixture 相关单测迁到 demo 包路径或保留并对新 import 更新

## 6. 风险

- 大搬迁易断相对 import → 分步：先加 demo 路由+拷贝/移动 fake，再删产品分支
- 共享展示组件被 demo 依赖时勿再引入 fixture 权威逻辑
