## Why

Crystalith 的插件机制已经走在正确方向上：entry points、enable/disable、last-wins、诊断信息……但到了真实使用场景，仍会频繁出现这种“卡住感”：

- 我装了 core，为什么 PDF 导不进来？是没装依赖，还是插件被禁用了？
- 我装了某个插件，但它到底覆盖了哪些能力？会不会和别的插件冲突？
- UI 里该怎么提示“你缺的是插件，而不是你操作错了”？

对个人私有部署来说，最理想的体验是：core-only 足够轻；想要更强能力时，安装路径清晰；系统自己能解释“现在缺什么、怎么补”。

这份 change 直接对齐 `openspec/specs/official-plugins/spec.md`，把“官方插件套件”的交付形态、安装档位和诊断基线做成可执行契约。

## What Changes

- 定义官方插件的交付形态：
  - 官方插件 MUST 作为独立可安装 Python 包交付，通过 `crystalith.plugins` entry points 暴露能力。
  - core MUST 不静态依赖这些实现（避免拉进 PDF/浏览器渲染等重依赖）。
- 给安装提供两个明确档位：
  - `core-only`：最小可用能力（轻依赖）。
  - `official-full`：官方插件全量（一次装齐）。
- 维护一个轻量的 official plugin catalog（不 import 插件实现）：
  - 列出官方插件 id、类型、预期覆盖能力、以及可执行的安装/启用提示。
  - 用于 tools/extractors 列表与 UI 能力矩阵展示：loaded / skipped / not_installed。
- 让“缺插件”变成产品提示，而不是异常堆栈：
  - 后端响应在 diagnostics 区域给出稳定的 error_code/message/hint（对齐 `c2102`）。
  - 前端按 diagnostics 渲染“你缺的是 X 插件 → 一条命令安装”的提示。

## Capabilities

### New Capabilities

- `official-plugins-bundles-and-catalog-diagnostics`: 官方插件 bundling、catalog 与对外诊断语义。

### Modified Capabilities

- `architecture-plugin-and-agent`：补齐“官方插件”这条可解释的发现与启用策略。
- `workspace-api-contract`：tools/diagnostics 的响应需要承载 official catalog 的状态计算结果。
- `frontend-bundle-loader-resilience-and-fallback-ux`（`c2123`）：当输出类型/渲染器来自插件时，缺失/不兼容要有一致的 fallback UX。
- `error-code-registry-and-api-error-shape-enforcement`（`c2102`）：缺插件/依赖缺失需要落到可复用 error_code。

## Impact

- Backend：需要一个“轻量 catalog + 状态计算”的实现，不引入插件 import 副作用。
- Frontend：能力矩阵与提示体验会明显变好，用户不会再被一堆依赖栈吓退。
- Dependencies：建议和 `c545-plugin-registry-health-and-compatibility-diagnostics`、`c2131-plugin-frontend-bundle-compat-matrix-and-smoke-tests` 互相引用，避免重复做诊断与 smoke test。

```mermaid
flowchart LR
  subgraph Build["Packaging"]
    CORE[core-only] -->|optional| FULL[official-full]
    FULL --> PKG[official plugin packages]
  end

  subgraph Runtime["Runtime"]
    CAT[Official catalog (static)] --> DIAG[Status compute]
    EP[Entry point scan] --> DIAG
    DIAG --> API[/v1/... tools + diagnostics/]
    API --> UI[Capability matrix + install hints]
  end
```
