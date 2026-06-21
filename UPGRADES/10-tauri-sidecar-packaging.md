# 10 — Tauri + Bun Sidecar 分发架构

> 本文档细化 [02](./02-target-stack-bun.md) 的"分发方案 A"：如何用 **Tauri v2** 包装 **Bun 编译的单二进制** 作为 sidecar，产出跨平台桌面 app（.dmg / .exe / .AppImage），支持自动更新。
>
> **结论先行：方案可行且成熟。** Tauri 的 `externalBin` sidecar 机制专为"嵌入 Node/Python/Bun 二进制"设计，官方文档明确把这种用法作为典型场景。Bun 编译二进制作为 sidecar 是天然组合。

## 架构总览

```
Tauri app（Rust shell，~10MB）
├─ src-tauri/（Rust 主进程）
│   ├─ Webview：加载 React 前端 dist/（嵌入二进制）
│   └─ sidecar：bun build --compile 出的 crystalith-server 二进制
│        ├─ 监听 127.0.0.1:随机端口
│        ├─ Elysia server（API）
│        ├─ bun:sqlite + sqlite-vec（本地数据）
│        └─ pi-agent-core（agent runtime）
└─ 分发产物：
    - macOS:  .dmg / .app
    - Windows: .exe / .msi
    - Linux:  .AppImage / .deb
```

**两个二进制的分工**：
- **Tauri 主进程（Rust）**：~10MB，负责窗口/菜单/托盘/自动更新/系统 API/进程生命周期。几乎不写 Rust，只是壳。
- **Bun sidecar**：~80MB（含 pi-ai + unpdf 等），负责全部业务（API + DB + agent）。Tauri 启动时拉起，退出时关闭。

总包体 ~90MB（macOS 通用二进制会更大，~150MB，因含双架构）。

## 为什么是 Tauri（而非 Electron）

| | Tauri v2 | Electron |
|--|----------|----------|
| 包体 | **~10MB shell**（用系统 webview） | ~150MB（捆绑 Chromium + Node） |
| 内存 | 低（系统 webview） | 高（Chromium 进程） |
| Rust 主进程 | ✅ | ❌（Node 主进程） |
| sidecar 支持 | ✅ 一等公民（`externalBin`） | 需手动打包额外二进制 |
| 自动更新 | ✅ `plugin-updater` | ✅ electron-updater |
| 适合本项目 | ✅✅ | ❌（违背"轻量分发"） |

**Tauri 与"轻量分发"目标完全契合**，且 sidecar 是其官方推荐模式。

## 关键配置

### 1. 编译 Bun sidecar（每个目标平台一个）

```bash
# Linux
bun build --compile --target=bun-linux-x64 ./src/server.ts --outfile=binaries/crystalith-server-x86_64-unknown-linux-gnu
# macOS (Intel)
bun build --compile --target=bun-darwin-x64 ./src/server.ts --outfile=binaries/crystalith-server-x86_64-apple-darwin
# macOS (Apple Silicon)
bun build --compile --target=bun-darwin-arm64 ./src/server.ts --outfile=binaries/crystalith-server-aarch64-apple-darwin
# Windows
bun build --compile --target=bun-windows-x64 ./src/server.ts --outfile=binaries/crystalith-server-x86_64-pc-windows-msvc.exe
```

**关键点**：文件名**必须带 target-triple 后缀**（如 `-x86_64-unknown-linux-gnu`），这是 Tauri 的约定，构建时按当前平台自动选择。

Bun 的 `--target` 支持交叉编译（不同于 Node，无需目标平台工具链），CI 矩阵里一次构建可出多平台二进制。

### 2. Tauri 配置（`src-tauri/tauri.conf.json`）

```json
{
  "bundle": {
    "externalBin": ["binaries/crystalith-server"]
  }
}
```

Tauri 构建时会按当前 target-triple 找到 `binaries/crystalith-server-<triple>[.exe]` 并嵌入安装包。

### 3. 权限（`src-tauri/capabilities/default.json`）

Tauri v2 的权限模型要求显式授权 sidecar 执行：

```json
{
  "permissions": [
    "core:default",
    {
      "identifier": "shell:allow-execute",
      "allow": [{ "name": "binaries/crystalith-server", "sidecar": true }]
    }
  ]
}
```

### 4. 启动 sidecar（Rust 侧，~20 行）

```rust
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;

#[tauri::main]
async fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let sidecar = app.shell().sidecar("crystalith-server").unwrap();
            let (mut rx, _child) = sidecar.spawn().expect("Failed to spawn sidecar");
            // 读 sidecar stdout（如端口就绪通知）转发给前端
            tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                    if let CommandEvent::Stdout(line) = event {
                        app.emit("server:log", String::from_utf8_lossy(&line)).ok();
                    }
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 5. 前端连接 sidecar（动态端口）

sidecar 启动时打印监听端口（如 `{"port": 51234}`），前端通过 Tauri event 拿到端口后用 Elysia eden 连接：

```typescript
import { treaty } from "@elysiajs/eden";
import { listen } from "@tauri-apps/api/event";
import type { App } from "../server";  // Elysia app 类型

// 等 sidecar 就绪
const unlisten = await listen<{ port: number }>("server:ready", (e) => {
  const api = treaty<App>(`http://127.0.0.1:${e.payload.port}`);
  // 后续所有调用走 api.xxx
});
```

## 自动更新

Tauri 的 `plugin-updater`（2.10.1）支持差分更新（只下补丁）：

```json
// tauri.conf.json
{
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": ["https://releases.crystalith.app/{{target}}/{{arch}}/{{current_version}}"],
      "pubkey": "<签名公钥>"
    }
  }
}
```

- **签名**：Tauri 要求更新包签名（`tauri signer sign`），私钥本地保管，公钥嵌入 app。
- **差分**：Tauri 自动生成 `.tar.gz` 增量包，用户只下载 diff。
- **发布**：CI 构建后上传到 GitHub Releases 或自建 endpoint，更新清单是 JSON。

由于 sidecar（Bun 二进制）被打包进 Tauri 安装包，**整个 app 一起更新**——无需单独的 Bun 二进制更新通道。

## 进程生命周期

| 事件 | 行为 |
|------|------|
| App 启动 | Tauri 主进程拉起 Bun sidecar（fork） |
| App 运行 | sidecar 在后台监听 localhost，前端 webview 调 localhost API |
| App 退出 | Tauri 自动 kill sidecar 子进程（或 sidecar 监听 SIGTERM 优雅关闭） |
| Crash 恢复 | sidecar 可内置 watchdog 自重启；或前端检测 API 失活后通知 Tauri 重启 sidecar |

**优雅关闭**：Bun 监听 `SIGTERM`，关闭 HTTP server + flush SQLite WAL + 退出。

## CI 构建矩阵

```yaml
# .github/workflows/release.yml
strategy:
  matrix:
    include:
      - { os: macos-latest, target: aarch64-apple-darwin, bun_target: bun-darwin-arm64 }
      - { os: macos-latest, target: x86_64-apple-darwin, bun_target: bun-darwin-x64 }
      - { os: ubuntu-latest, target: x86_64-unknown-linux-gnu, bun_target: bun-linux-x64 }
      - { os: windows-latest, target: x86_64-pc-windows-msvc, bun_target: bun-windows-x64 }

steps:
  - uses: oven-sh/setup-bun@v2
  - run: bun install
  - run: bun run build:web            # 前端 dist/
  - run: bun build --compile --target=${{ matrix.bun_target }} ./src/server.ts --outfile=src-tauri/binaries/crystalith-server-${{ matrix.target }}${{ matrix.ext }}
  - uses: tauri-apps/tauri-action@v0  # 出 .dmg/.exe/.AppImage + 签名 + 上传更新清单
```

Bun 的交叉编译让 macOS 双架构可在同一 runner 出，无需双 macOS CI。

## 风险与应对

| 风险 | 严重度 | 应对 |
|------|--------|------|
| Bun sidecar 启动慢（首次加载 wasm/字体） | 🟢 低 | 启动 splash + sidecar 输出 ready 信号后再切主界面 |
| 系统 webview 差异（macOS WebKit vs Windows WebView2 vs Linux WebKitGTK） | 🟡 中 | 前端用标准 API；Linux 用户可能需装 webkit2gtk（或在 .deb 依赖里声明） |
| Tauri 学习曲线（Rust） | 🟢 低 | Rust 代码极少（~50 行壳），主要靠配置 |
| 端口冲突 | 🟢 低 | sidecar 绑 0 让 OS 分配空闲端口，经 event 通知前端 |
| 杀软误报（未签名二进制） | 🟡 中 | 代码签名（macOS notarize / Windows EV cert），成本 ~$100/年 |

## 分阶段落地

| 阶段 | 形态 | 说明 |
|------|------|------|
| **P1–P2** | 方案 B：纯 Bun 二进制 + 浏览器访问 | 快速迭代，验证业务逻辑。`bun build --compile` + 前端嵌入 |
| **P3** | 引入 Tauri 包装（本文方案 A） | 加桌面外壳，系统托盘，自动更新 |
| **P4** | 签名 + 发布到各平台商店（可选） | macOS Notarization / Windows Store / Snap |

**先 B 后 A**：B 阶段前端跑在浏览器里就能验证所有业务，Tauri 只是最后的"包装"，不阻塞核心开发。

## 相关文档
- [02-target-stack-bun.md](./02-target-stack-bun.md) — Bun 技术栈（本文细化其分发方案 A）
- [08-web-framework-elysia-vs-hono.md](./08-web-framework-elysia-vs-hono.md) — Elysia eden 与 Tauri event 配合连接 sidecar
- [09-pdf-benchmark.md](./09-pdf-benchmark.md) — 验证 unpdf 能进 Bun sidecar 单二进制
