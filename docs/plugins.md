# Crystalith 插件作者指引（v1，npm 分发）

> 宿主契约见 `llmanspec/specs/architecture-plugin-and-agent`（r7/r11）；
> 行为级契约按 kind 细化：extractor 见 `web-extractor-plugins`，
> slides workflow 见 `slides-workflow-plugins`。

## 形态

一个 Crystalith 插件 = 一个 npm 包，**default export** 一个 `CrystalithPlugin`
对象：

```ts
import type { CrystalithPlugin } from 'crystalith/server'; // 类型随 server 包发布

const plugin: CrystalithPlugin = {
  id: 'extractor-myreader', // 全局唯一；约定 `<kind>-<name>`
  kind: 'extractor', // 'output-type' | 'extractor' | 'parser' | 'slides-workflow'
  displayName: 'My Reader',
  description: '……',
  recoveryHint: 'Set MYREADER_API_KEY', // 不可用时的可执行提示
  configSchema: z.object({}), // Zod；派生 app.schema / OpenAPI
  capabilities: ['requires-api-key', 'requires-service'],
  factory: async (ctx) => {
    // ctx: { config: 解析后的插件配置, dataRoot }
    return myExtractorImplementation; // shape 由 kind 决定
  },
};

export default plugin;
```

## 安装与加载语义（重要）

- **安装 = 加 npm 依赖 + 重启 server**。宿主在启动时从
  `node_modules/@crystalith-plugin/*` 发现并动态 import 已安装包；
  **没有运行时热插拔**，升级/禁用一律重启生效。
- 包名约定 scope：`@crystalith-plugin/<id>`（id = 包名去掉 scope）。
- 必须纯 JavaScript：**禁止 native addon**（二进制分发形态下无法保证跨平台）。

## 启用策略（运维边界，UI 不直接改）

`config/app.yaml`：

```yaml
plugins:
  # enabled: ["extractor-myreader"]   # 白名单；留空 = 全部已安装插件
  disabled: [] # 黑名单；优先级高于 enabled
  load_order: [] # 冲突消解：后加载者优先
```

加载失败（导入失败 / factory 抛错 / 被策略跳过）**不会阻断启动**，会出现在
`GET /v2/workspace/tools` 的 `diagnostics.plugins.skipped`（含 errorCode 与
恢复提示）；`diagnostics.official` 列出全部已注册官方插件及其来源
（`builtin` / `installed`）。

## 本地快速调试（以 extractor-arxiv 为样例）

**开发形态**：monorepo 内 `packages/plugin-extractor-arxiv`（包名
`@crystalith-plugin/extractor-arxiv`）。根 `package.json` 的 devDependencies
用 `workspace:*` 引用它 → `bun install` 后 symlink 进
`node_modules/@crystalith-plugin/` → registry discovery 直接命中，**无需发包**。

**调试循环（免启服，最快）**：

```bash
# 仓库根目录运行；网络走宿主同款出站链路（见下节代理）
bun packages/plugin-extractor-arxiv/scripts/try.ts https://arxiv.org/abs/1706.03762
# 非 arxiv URL → 观察空内容降级语义
bun packages/plugin-extractor-arxiv/scripts/try.ts https://example.com
```

**server 内联调**：`just dev` 启动后插件即被加载（`GET /v2/workspace/tools`
的 `diagnostics.plugins.loaded` 应含 `extractor-arxiv`）。编辑插件代码后，
按加载语义**重启 server 生效**（`just dev-quit && just dev`；插件是
restart-loaded，没有热重载）。

**链路位置**：外部插件默认注册在内置之后（链尾）。想让 arxiv 在 fallback
链里优先（它对非 arxiv URL 返回空内容、无副作用）：

```yaml
plugins:
  load_order: ['extractor-arxiv']
```

或单次摄入指定 `preferredExtractor: arxiv`（r113）。

## 代理配置（网络问题）

插件 **不出 own 网络逻辑**：factory 收到的 `ctx.fetch` 就是宿主的
`outboundFetch`，与 URL 导入/网页搜索共用同一条代理 SSOT。网络不通时按
优先级排查：

1. `config/app.yaml` 的 `proxy_settings`（`enabled` / `http_url` /
   `https_url`）；
2. 环境变量覆盖：`CL_PROXY_ENABLED` / `CL_PROXY_HTTP_URL` /
   `CL_PROXY_HTTPS_URL`（留空跟随 yaml）；
3. 临时一次性调试：命令前缀 `HTTPS_PROXY=http://<proxy> bun
packages/plugin-extractor-arxiv/scripts/try.ts …`（对遵循标准代理变量
   的工具同样适用）。

`localhost` / `127.0.0.1` 默认在 `no_proxy` 内，不受影响。

## 官方 scope 与收编

- `@crystalith-plugin/*` scope 下的包自动进入 official catalog 候选。
- 仓库内置插件（如 `slides-slidev`、`extractor-*`）与外部插件走**同一条
  registry 注册路径**，可作为外部插件的参考实现（源码见
  `apps/server/src/plugins/builtin/`）。

## 路线：榜样插件与暴露面（先窄，需求驱动）

> 原则：**宁可暂时没有外部插件，也不为"证明可扩展"造 demo 插件**——榜样必须
> 踩在真实需求上，否则接口会朝着假需求腐烂（slop）。

### 暴露面现状（有意收窄）

| kind              | 宿主接线                                                   | 对外承诺                       |
| ----------------- | ---------------------------------------------------------- | ------------------------------ |
| `extractor`       | ✅ 全链路（registry → fallback 编排 → diagnostics → 策略） | **v1 唯一开放的外部插件 kind** |
| `slides-workflow` | ⏳ 半接线（discovery/catalog 已通；生成链路未接 registry） | 暂不对外                       |
| `parser`          | ❌ 未接线（ingestion 不消费 parser 插件）                  | 暂不对外                       |
| `output-type`     | ❌ 按 r7 DEFERRED（OUTPUT_META 过渡）                      | 长期不开（前端 bundle 成本高） |

接口 union 里保留全部四个 kind = **兼容与扩展的口子**；但文档、指南、catalog
宣传只覆盖 `extractor`——「能扩展」不等于「到处都能挂」。

### 第一梯队榜样：`@crystalith-plugin/extractor-arxiv`（draft：`add-extractor-arxiv`）

- **需求**：arXiv 是研究者用户最高频来源；abs 页经 readability 抽取后混杂
  导航/引用噪声，作者/摘要/分类等元数据无法结构化保留
- **形态（极简）**：export.arxiv.org Atom API 稳定、无 key、纯 JS；
  `isAvailable` 恒定可用 + `extract` 内按 host（`arxiv.org/abs/*`）判定，
  非目标 URL 返回空内容 → 编排层自然降级；目标 URL → markdown + 结构化
  元数据（title/authors/abstract/published/primary_category）
- **为什么它当第一榜样**：~百行、确定性输出、零外部脆弱依赖——同时完整踩过
  外部插件全流程（scope 发现、动态 import、host 门控、fallback 链、
  `plugins.*` 策略、`diagnostics.plugins.skipped`、official catalog），
  且因为输出确定，它天然就是后续给插件写验收测试的**标准测试夹具**
- **开发故事**：monorepo 内 `packages/plugin-extractor-arxiv`（包名
  `@crystalith-plugin/extractor-arxiv`），bun workspaces symlink 进根
  node_modules → discovery 直接命中，无需发包即可联调；成熟后独立发 npm

### 第二梯队（按序）

1. `extractor-github`：raw 源取 README/文档，markdown 直出；优先级低于
   arxiv（readability 对 github 页面尚可用，增益相对小）
2. `parser` 宿主接线（ingestion 按扩展名 consult parser 插件）→ 榜样
   `parser-docx`（mammoth，纯 JS；讲义/论文上传是真实需求）
3. `slides-workflow` 生成链路接 registry → 第二个 slides 插件（解锁 r102
   「多候选 → 结构化诊断」的真实验证）
4. `output-type`：维持关闭，等出现反复出现的、现有六类型表达不了的真实产出需求

### 已评估并暂缓

- `extractor-youtube`：需求最大（视频→笔记），但**难度/脆弱度不成比例**——
  timedtext 端点反爬、播放器签名演进、区域锁，第三方 transcript 方案维护
  状态普遍差；做榜样会把"最不稳的依赖"放进"最需要稳定的示范位"。
  **暂缓**，等出现维护良好的 transcript 方案，或以 connector 形态（带
  sync_check 的拉取型来源）另议。
