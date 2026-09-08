# Design — plugin-interface-ssot

## D1 接口形状

```ts
type CrystalithPluginKind = 'output-type' | 'extractor' | 'parser' | 'slides-workflow';

interface CrystalithPluginContext {
  config: parsedConfigSchema; // 该插件 configSchema 的解析产物
  logger: Logger;
  dataRoot: string; // CL_DATA_ROOT 派生（configuration-governance）
}

interface CrystalithPlugin {
  id: string; // 全局唯一，如 'extractor-trafilatura'
  kind: CrystalithPluginKind;
  displayName: string;
  configSchema: z.ZodObject; // 供 app.schema / openapi 派生
  capabilities?: string[]; // 能力声明（如 'preview' | 'frontend-bundle'）
  factory: (ctx: CrystalithPluginContext) => Promise<PluginImplementation>;
}
```

- `PluginImplementation` 按 kind 收窄（extractor → extract(url, opts)；
  slides-workflow → outline/markdown/previewDescriptor…），既有 per-kind 契约
  （web-extractor-plugins、slides-workflow-plugins r44）**保持为 kind 层的细化，
  不被本接口取代**——本接口解决「注册/发现/配置/目录」的统一，不吞并行为契约。
- 内置实现与外部 npm 插件走**同一条注册路径**：内置 = 仓库内
  `apps/server/src/plugins/builtin/*` 导出的 `CrystalithPlugin`；
  外部 = npm 包默认导出 `CrystalithPlugin`。

## D2 迁移策略：expand-contract

这是「一个接口扫多域」的机械重构，按 expand-contract 排序（非垂直切片）：

1. expand：新增 `apps/server/src/plugins/`（types + registry + builtin 目录），
   与既有两套形状并存
2. migrate：extractor factory、studio config 表逐个改为经由 registry 注册；
   调用处（sources fetch、studio 生成、workspace tools）改读 registry
3. contract：删除旧形状（内置表直查、factory 内部数组），保留兼容 re-export
   一个发布周期后移除

每步 `just qa` 全绿（既有测试即行为不变证明），无 wire diff。

## D3 npm 加载语义

- 插件 = server 的 npm dependency；启动时对 allowlist（`plugins.enabled`，
  未配置则取「全部内置 + scope 内已安装官方插件」）逐个
  `await import(<pkg>)`（node_modules 运行时解析，bun 原生支持）
- 失败语义沿用 workspace-api-contract r18：进 `diagnostics.plugins.skipped`
  （errorCode/message/hint），不阻断启动
- 解析根：dev 模式 = 仓库 node_modules；二进制形态 = 二进制同级 `node_modules`
  （`ship-server-binary` 的分发布局保证该目录随 archive 存在）
- 不做：版本协商、peer 依赖解析、卸载即生效——全部「重启生效」

## D4 official catalog

`/v2/workspace/tools` 的 official catalog 改由 registry 清单驱动：
内置插件标记 `builtin: true`；`@crystalith-plugin/*` scope 的已安装插件标记
`installable/installableHint`。r18 的「catalog 覆盖全部官方插件」由此满足，
无新增 wire 字段（如确需 `builtin` 标记，走 verify 阶段确认 r18 措辞覆盖）。

## 测试边界（seam）

- 复用既有 harness：`bun test apps/server/tests/`（`just test`）为主 seam
- 公共边界：`plugins/registry` 的注册/查询函数；`/v2/workspace/tools`
  契约测试（diagnostics 形状）；extractor 选择与 slides active 选择的行为测试
  （web-extractor-plugins / slides-workflow-plugins 既有用例必须原样通过）
- BDD runner 不在本 change 启用（现有 CRUD 子集不含插件域）
