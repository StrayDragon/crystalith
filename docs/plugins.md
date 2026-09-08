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

## 官方 scope 与收编

- `@crystalith-plugin/*` scope 下的包自动进入 official catalog 候选。
- 仓库内置插件（如 `slides-slidev`、`extractor-*`）与外部插件走**同一条
  registry 注册路径**，可作为外部插件的参考实现（源码见
  `apps/server/src/plugins/builtin/`）。
