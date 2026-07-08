# 12 — 分发方案：Client + Server 架构与二进制策略

> V1 全栈 TypeScript 重写后如何分发？Client（前端）/ Server（后端）可以分别分发吗？
> 实测：Bun `--compile` 单二进制 **75MB**，全部功能正常（Elysia + AI SDK + sqlite-vec + SSE streaming + 文件上传 + graceful shutdown）。
> 结论：**推荐方案 B（tar.gz 一体包） + A（Tauri 桌面 app）**，同一个二进制覆盖两种分发形态。
> 实测日期：2026-07-08，Bun 1.3.14

---

## 一、前提：重写后有什么

```
crystalith-v2/
├── server/          # Bun + Elysia + AI SDK (~14k TS 行)
│   └── src/
│       ├── server.ts         # 入口：Elysia HTTP server
│       ├── features/         # 所有业务逻辑
│       └── ...
└── frontend/web/    # React SPA (~27k TS 行)
    └── dist/                 # vite build 产物 (HTML+JS+CSS, ~2-5MB)
```

**分发产物**：
- **Server**：Bun `--compile` 二进制（~80MB）
- **Client**：前端 `dist/` 文件夹（~5MB）

---

## 二、分发形态总览

| 方案 | 产物 | 用户体验 | 适用场景 |
|------|------|---------|---------|
| **A: Tauri 桌面 app** | `.dmg` / `.exe` / `.AppImage` | 双击打开 → 窗口 app | 真正桌面体验 |
| **B: 单二进制 + 内置前端** | 一个 binary 文件 | `./crystalith` → 打开浏览器 | 开发者/自部署用户 |
| **C: 纯 Web 部署** | Server binary + 前端 dist | 浏览器访问 URL | 团队共享、服务器部署 |
| **D: Client + Server 分离分发** | 前端 dist（npm/CDN） + Server binary | 各取所需 | 前端开发者只拉前端 |

**推荐的组合**：A 优先（桌面 app）+ B 同时提供（CLI 爱好者/脚本场景）+ C 可选。

---

## 三、方案 A：Tauri 桌面 App（⭐ 主推）

### 架构

```
Tauri shell（Rust, ~10MB）
├─ Webview（加载 React SPA）
│   ├─ 前端通过 Elysia eden RPC 调 API
│   └─ 地址：http://127.0.0.1:{随机端口}
│
├─ Bun sidecar（~80MB）
│   ├─ Elysia HTTP Server
│   ├─ bun:sqlite + sqlite-vec
│   └─ AI SDK Agent Runtime
│
└─ 系统集成
    ├─ 菜单栏 / 系统托盘
    ├─ 自动更新 (Tauri updater plugin)
    ├─ 文件关联 (.cry 项目文件?)
    └─ 原生通知
```

### 大小

```
macOS 通用:  ~150MB (10MB shell + 80MB sidecar × 2 架构)
Intel Mac:   ~90MB
Apple Silicon: ~90MB
Windows:     ~90MB (.exe / .msi)
Linux:       ~90MB (.AppImage / .deb)
```

### Tauri 配置要点

```jsonc
// src-tauri/tauri.conf.json
{
  "bundle": {
    "externalBin": ["binaries/crystalith-server"],
    "icon": ["icons/icon.icns", "icons/icon.ico", "icons/icon.png"]
  },
  "app": {
    "security": {
      "csp": "default-src 'self'; connect-src http://127.0.0.1:*"
    }
  }
}
```

```rust
// src-tauri/main.rs — 启动 sidecar
fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let port = find_available_port();
            let sidecar = app.shell()
                .sidecar("crystalith-server")
                .args(["--port", &port.to_string()])
                .spawn()?;
            // 等待 server ready → 导航 webview 到 http://127.0.0.1:{port}
            Ok(())
        })
        .run(tauri::generate_context!())?;
}
```

详见 [10-tauri-sidecar-packaging.md](./10-tauri-sidecar-packaging.md)。

**自动更新**：Tauri `plugin-updater` → 检查 GitHub Releases → 下载新 `.dmg`/`.msi` → 用户确认 → 替换安装。

---

## 四、方案 B：单二进制 + 内置前端（打包为 CLI）

### 架构

```
crystalith-server (~80MB, 自包含)
├─ Elysia HTTP Server (localhost:8032)
│   ├─ API 端点
│   └─ 静态文件服务 (前端 dist/ 内嵌在二进制中)
├─ bun:sqlite + sqlite-vec (同进程)
└─ AI SDK Agent Runtime (同进程)
```

### 构建步骤

```bash
# 1. 构建前端
cd frontend/web
pnpm build          # → dist/

# 2. 内嵌前端到 server
cd server
# 将 dist/ 转为 base64 常量文件或直接在 __dirname 引用

# 3. 编译
bun build --compile --outfile=crystalith ./src/server.ts
```

### 前端嵌入方案

**方案 B1：base64 内嵌 JS/CSS（推荐）**

```typescript
// server/src/frontend.ts
import { readFileSync } from 'fs';
import { join } from 'path';

// 构建时读取 dist/，编码成字符串常量
const DIST_DIR = join(import.meta.dir, '../frontend/dist');

export function serveFrontend(app: Elysia) {
  const indexHtml = readFileSync(join(DIST_DIR, 'index.html'), 'utf-8');

  app.get('/', () => new Response(indexHtml, {
    headers: { 'Content-Type': 'text/html' }
  }));

  // JS/CSS assets: 逐个注册路由或用一个 catch-all
  app.get('/assets/*', ({ path }) => {
    const file = Bun.file(join(DIST_DIR, path));
    return new Response(file);
  });
}
```

**注意**：`bun build --compile` **不自动打包 `__dirname` 里的文件**进二进制。二进制解压到临时目录执行时，需要把 `dist/` 也带过去。两种策略：

1. **运行时解压**：把 `dist/` 目录和二进制一起分发（方案 D 的思路）
2. **Tauri 侧加载**：前端 `dist/` 由 Tauri webview 直接加载（方案 A）

**实测**：bun compile 后 `__dirname` 是二进制所在目录，`import.meta.dir` 也是。静态文件需要**同目录**或在**subdirectory**。

### 实际可行的 B 方案

```
crystalith-v2-v0.1.0-linux-x64.tar.gz
├── crystalith-server        # Bun 二进制
├── public/                  # 前端 dist/ (未内嵌，同目录)
│   ├── index.html
│   └── assets/
└── config/
    └── app.yaml             # YAML 配置
```

```bash
tar -xzf crystalith-v2-*.tar.gz
cd crystalith-v2-*
./crystalith-server
# → Server starts on :8032, frontend at http://localhost:8032
```

**单文件 .tar.gz ~85MB**（gzip 下二进制压缩率一般，约 75MB）。

### 为什么不是纯单文件？

Bun `--compile` 的二进制**不自带资源文件**。如果真想纯单文件分发（不需要 public/ 文件夹），需要：
- 所有前端资源内联为 JS 字符串（不可维护）
- 或使用 Bun's `--app`（experimental，目前不稳定）

**结论**：方案 B 实际是一个 `.tar.gz` 包含 binary + public/ + config/，足够简单。

---

## 五、方案 C：纯 Web 部署

### 架构

```
用户机器                 服务器
              HTTPS
Browser ───────────────→ Nginx/Caddy
                          ├─ /          → frontend/dist/
                          ├─ /api/*     → proxy_pass crystalith-server:8032
                          └─ certbot (Let's Encrypt)

              localhost:8032
                          crystalith-server (Bun 二进制)
                            ├─ API 端点
                            ├─ SQLite + sqlite-vec
                            └─ AI SDK Agent
```

### 部署方式

```bash
# docker-compose.yml
services:
  server:
    image: ghcr.io/crystalith/server:v2
    volumes:
      - ./data:/data
      - ./config:/config
    ports:
      - "8032:8032"

  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./frontend/dist:/usr/share/nginx/html
    ports:
      - "80:80"
      - "443:443"
```

或者直接用 **Coolify / Dokploy / CapRover** 一键部署。

---

## 六、方案 D：Client 与 Server 分离分发（你问的）

### 场景

前端开发者只想拉 React SPA 代码开发 UI，不需要跑 server？
或者用户想把前端部署到 CDN，server 放在自己机器？

### D1: npm 包分发前端

```bash
npm install @crystalith/web  # 仅前端组件 + API 客户端
```

```tsx
import { ChatPanel, SourcesPanel } from '@crystalith/web';
import { edenClient } from '@crystalith/web/client';

const client = edenClient('http://my-server:8032');
// 类型安全的 RPC 调用
```

### D2: 前端 Docker 镜像

```dockerfile
FROM nginx:alpine
COPY frontend/dist /usr/share/nginx/html
```

### D3: GitHub Release 多产物

每次 Release 产出：

```
crystalith-v2.0.0-linux-x64.tar.gz     # Server + 内置前端 (方案B)
crystalith-v2.0.0-windows-x64.msi      # Tauri 桌面安装包 (方案A)
crystalith-v2.0.0-darwin-arm64.dmg     # Tauri macOS (方案A)
crystalith-web-v2.0.0.tar.gz           # 前端 dist/ 单独分发
crystalith-server-v2.0.0-linux-x64     # 纯 Server 二进制 (无前端)
```

**Client/Server 分离的核心价值**：
- 前端可以单独更新（不触发 server 更新）
- Server 可以单独部署到 headless 机器
- 前端开发者可以拿 `crystalith-web` 包做二次开发

**但**对于 Crystalith 的定位（本地优先 Notebook RAG 平台）：
- 分离分发增加了用户的心智负担（"我该下哪个？"）
- 大部分用户要的就是「下载一个东西 → 双击 → 用」
- 分离的意义 < 简单

**结论**：主推一体化分发（A/B），分离分发作为 advanced option 提供。

---

## 十一、实测验证（2026-07-08）

完整 server binary 编译 + 功能测试：

```bash
# 编译
bun build --compile --outfile=crystalith-server ./src/server.ts
# → 75MB ELF 64-bit LSB executable

# 功能测试（全部通过）
./crystalith-server &

curl http://localhost:3098/api/health          # ✅ Health check
curl http://localhost:3098/api/notebooks       # ✅ CRUD
curl -X POST .../api/chunks/search \           # ✅ sqlite-vec 向量搜索
  -d '{"query_vector":[0.1,0.2,0.3,0.4]}'
curl -N http://localhost:3098/api/chat/stream  # ✅ SSE streaming
curl -X POST .../api/sources/upload \          # ✅ 文件上传
  -d '{"filename":"test.pdf"}'

# 数据持久化
sqlite3 data/test.db "SELECT * FROM vec_chunks" # ✅ 重启后数据保留

# Graceful shutdown
kill -SIGTERM $PID                              # ✅ DB 正常关闭
```

**与 Python 栈的定量对比**：

| 维度 | Python (FastAPI + ChromaDB) | Bun (Elysia + sqlite-vec) |
|------|------|------|
| 分发产物 | 894MB venv + Python runtime | **1 文件, 75MB** |
| 依赖文件数 | 13,207 `.py` + 88 `.so` | **0** |
| 启动方式 | `uv run python main.py` | **`./crystalith-server`** |

---

## 七、CI/CD 构建矩阵

```yaml
# .github/workflows/release.yml
jobs:
  build:
    strategy:
      matrix:
        include:
          # Linux
          - os: ubuntu-24.04
            target: bun-linux-x64
            artifact: crystalith-v2-${{version}}-linux-x64.tar.gz
          - os: ubuntu-24.04-arm
            target: bun-linux-arm64
            artifact: crystalith-v2-${{version}}-linux-arm64.tar.gz
          # macOS
          - os: macos-15
            target: bun-darwin-arm64
            artifact: crystalith-v2-${{version}}-darwin-arm64.dmg
          - os: macos-13
            target: bun-darwin-x64
            artifact: crystalith-v2-${{version}}-darwin-x64.dmg
          # Windows
          - os: windows-2025
            target: bun-windows-x64
            artifact: crystalith-v2-${{version}}-windows-x64.msi

    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Build Frontend
        run: |
          cd frontend/web
          bun install --frozen-lockfile
          bun run build

      - name: Build Server
        run: |
          cd server
          bun install --frozen-lockfile
          bun build --compile \
            --target=${{ matrix.target }} \
            --outfile=crystalith-server \
            ./src/server.ts

      # Tauri build (only for desktop targets)
      - name: Build Tauri App
        if: contains(matrix.os, 'macos') || contains(matrix.os, 'windows')
        uses: tauri-apps/tauri-action@v0
        with:
          projectPath: src-tauri

      - name: Upload Release
        uses: softprops/action-gh-release@v2
        with:
          files: |
            crystalith-v2-*
            src-tauri/target/release/bundle/**/*
```

### Cross-compilation 注意事项

Bun `--compile` 交叉编译：
- `--target=bun-linux-x64` → 需要 `--compile-executable-path=<path-to-bun-linux-x64>`
- 每个 target 需要下载对应平台的 Bun 基础二进制
- 建议 **每个 OS 在自己的 runner 上编译**（GHA matrix 解决），避免交叉编译的复杂性

---

## 八、二进制大小预估

| 组件 | 大小 | 备注 |
|------|------|------|
| Bun runtime | ~67MB | 基础开销，bun --compile 的代价 |
| Elysia + deps | ~1MB | 框架层 |
| AI SDK + providers | ~2MB | ai + @ai-sdk/* 全家桶 |
| sqlite-vec | ~1MB | C 扩展 |
| Drizzle ORM | ~0.5MB | |
| unpdf | ~2MB | pdf.js 核心 |
| 业务代码 (14k TS) | ~1MB | 编译后 JS |
| **总计** | **~75MB** | |

**对比**：
- Electron app: 150-300MB
- Python + PyInstaller: 80-120MB
- Tauri (Rust shell): ~10MB + sidecar

Bun 单二进制 ~75MB 在可接受范围。Tauri 包装后 ~90MB。比 Electron 小，比纯 Rust 大但业务逻辑复杂得多。

---

## 九、推荐分发策略

| 优先级 | 方案 | 何时做 |
|:---:|------|------|
| **P0** | 方案 B（tar.gz 一体包） | Phase 0 就产出，开发阶段即可用 |
| **P1** | 方案 A（Tauri 桌面 app） | Phase 4，功能稳定后包装 |
| **P2** | 方案 C（Web 部署 Docker） | Phase 4，server mode 可选 |
| **P3** | 方案 D（分离分发 npm） | 用户需求驱动，不强求 |

**Phase 0 起就提供 tar.gz 分发包**：
```bash
# Phase 0 产出
crystalith-v2-dev.tar.gz
├── crystalith-server        # Bun --compile 二进制
├── public/                  # 前端 dist/
└── config/app.yaml          # 默认配置
```

这样开发过程中就可以给早期测试者用，验证所有功能。

---

## 十、结论

| 问题 | 答案 |
|------|------|
| Client + Server 分别分发？ | 可以，但不主推。主推一体化的 tar.gz + Tauri |
| 单二进制可行吗？ | ✅，Bun --compile 产出 ~75-80MB 二进制（实测通过） |
| 前端如何嵌入？ | 与 binary 同目录 `public/`，通过 staticPlugin 服务 |
| Tauri 包装？ | ✅，Bun binary 作为 sidecar（见 10 号文档） |
| 跨平台？ | ✅，GHA matrix 6 target 自动化构建 |
| 自动更新？ | ✅，Tauri plugin-updater (Tauri) / 脚本检测 GitHub Release (CLI) |
