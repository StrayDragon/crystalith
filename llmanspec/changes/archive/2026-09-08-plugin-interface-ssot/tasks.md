# Tasks — plugin-interface-ssot

> 按 expand-contract 排序（见 design D2）；每个 task 完成后 `just qa` 必须全绿。
> Seam：`bun test apps/server/tests/` + `/v2/workspace/tools` 契约测试 +
> extractor/slides 既有行为用例原样通过。

## T1 接口与 registry（expand）

- [x] 新增 `apps/server/src/plugins/types.ts`：`CrystalithPluginKind` /
      `CrystalithPluginContext` / `CrystalithPlugin` / `PluginImplementation`（按 kind 收窄）
- [x] 新增 `apps/server/src/plugins/registry.ts`：register / list / getById / byKind，
      含 `plugins.enabled|disabled|load_order` 冲突消解（loaded last wins，沿用现配置键）
- [x] registry 单测：allowlist/denylist/load_order/重复 id 诊断
- [x] 新增 `apps/server/src/plugins/builtin/` 目录骨架（暂空）

## T2 extractor factory 迁移（migrate）

- [x] `shared/extraction/factory.ts` 的内置 extractor 以 `CrystalithPlugin`
      （kind: 'extractor'）经 registry 注册；选择/fallback/可用性清单改读 registry
- [x] `web-extractor-plugins` 既有用例（选择、preferredExtractor、fallback 可观测、
      全局/notebook 策略）原样通过
- [x] `config/app.yaml` plugins 段清理 v1 Python 注释（键不变）

## T3 studio config 表迁移（migrate）

- [x] studio slides config 表以 `CrystalithPlugin`（kind: 'slides-workflow'）
      经 registry 注册；active plugin 选择改读 registry（单活跃/可诊断语义不变）
- [x] `slides-workflow-plugins` 既有用例与 studio 生成用例原样通过

## T4 official catalog 由 registry 驱动（migrate）

- [x] `/v2/workspace/tools` diagnostics official catalog 数据源切换为 registry 清单
      （builtin 标记 + `@crystalith-plugin/*` 已安装探测），wire 形状不变
- [x] workspace tools 契约测试更新断言数据源而非形状

## T5 npm 外部插件加载路径（expand）

- [x] 启动加载器：从 node_modules 动态 import allowlist 插件；失败进
      `diagnostics.plugins.skipped`（errorCode/message/hint），不阻断启动
- [x] 加载器单测：已安装/未安装/抛错三类路径（mock 包）
- [x] 文档：插件作者指引（`@crystalith-plugin/*` scope、纯 JS 约束、安装=依赖+重启）

## T6 收缩旧形状（contract）[blocked-by: T2, T3]

- [x] 删除 extractor factory 内部数组与 studio config 内置表的旧注册路径
      （保留一个发布周期的兼容 re-export 后移除）
- [x] 全局搜索确认无调用方直查旧形状；`just qa` 全绿
