# Design — ship-server-binary

## 决策点与取舍

### D1 静态 web 资源注入方式

| 方案                                                       | 取舍                                                                    |
| ---------------------------------------------------------- | ----------------------------------------------------------------------- |
| A. 构建期嵌入二进制（`bun build --compile` 资产嵌入）      | 单文件交付最纯粹；但每次前端改动都要重编二进制；嵌入资产体积 +web dist  |
| B. 二进制 + 同目录 `web/dist` 资源目录（zip/tarball 分发） | 构建简单、前端可独立热替换；分发物从 1 变 2（可接受：仍是一个 archive） |
| C. 首次启动从网络拉取                                      | 拒绝——离线/内网场景失效，违背 headless 初衷                             |

**选 B**：`crystalith-server-<ver>-<os>-<arch>.tar.gz` = 二进制 + `web/dist/`；
启动时 `CL_WEB_DIST`（默认取二进制同级 `web/dist`，可覆盖）存在则托管静态
资源，不存在则仅 API 模式（纯 headless/TUI 用户不需要前端）。

### D2 版本号

单一来源：git tag（`v*`）→ 构建时注入（`--define`/env）。`package.json`
version 保留但发布以 tag 为准；`/health` 的 `version` 字段与二进制 `--version` 输出同源。

### D3 跨平台矩阵

首版：macOS（arm64/x64）、linux（x64/arm64）、windows（x64）。
风险：sqlite-vec / unpdf 原生或 wasm 依赖在各 target 的可用性——构建管线
必须对每个 target 跑冒烟（启动 + `/health` + 一次向量检索）才算产物合格。
windows 首版允许降级为「实验性」标注。

### D4 与 plugin-interface-ssot 的边界

本 change 不含任何插件机制；npm 插件的「安装目录解析」（server 的 node_modules
在编译产物中如何定位）由 plugin-interface-ssot 的 design 处理，本 change 仅保证
`CL_DATA_ROOT`/CWD 语义在二进制形态下不变。

## 非目标

- Tauri 桌面应用（delay，后继 change）
- 自动更新通道（首版手动下载）
- Windows 代码签名 / macOS notarization（开源初期不做，文档说明 Gatekeeper 提示）
