# 开源发布前 Checklist

> 汇总 2026-09-07 开源准备梳理的结论与决定。发布前逐项勾选；已完成项保留记录。

## P0 — 发布阻塞项

- [x] **Git 历史清洗（密钥泄露）**（2026-09-07 完成）
  - 泄露内容：`sk-WeJOLb…`（局域网 llama.cpp 网关 key，对应 host `gateway.lan:50256/v1`，即现 tufa 那台机器，非云服务凭据）
  - 涉及提交：`cbbeed87`（2026-01-13，写入 `config/app.yaml`）→ `20a7fa9d`（2026-02-11，改为 env 注入时移除）
  - 已执行：`git filter-repo --replace-text` 全量改写（1071 commits，含 stash），并 force-push `main` / `v1` / `v2-dev` / `v0.1.0`；pickaxe 全 refs 复查为空，旧对象已 gc
  - 决定：**无需轮换 key**（纯局域网凭据，出网不可达）
  - 改写前全量备份：仓库旁 `crystalith-pre-rewrite-backup.bundle`（确认无误后可删）
  - 注意：其他机器上的旧 clone 与远端历史已不兼容，需重新 clone
- [x] **README 重写**（2026-09-09 完成）
  - 已补：项目简介 / 核心特性 / quickstart（Bun、overmind+tmux、LLM 网关配置）/ 部署（`just release` 产物布局）/ 开发门禁 / 文档索引；风格对齐 `../lspz`（居中 logo + badges + 表格化特性）
  - 语言：**中文优先**（已决定）；i18n 留口子，后续交社区
  - 未含：产品截图（可在发布前补一张 workspace 视图）；CI badge（CI 暂不接）
  - 分发管线随本批次落地：`just build-binary` / `just release` + server 静态托管（c13 v1 部分，见 `llmanspec/changes/ship-server-binary`）
- [ ] **内部 SDD 机制清理**（已决定清理，发布时执行）
  - 涉及：`llmanspec/`、`_archive/`、`.agents/skills/`、`CLAUDE.md`、`skills-lock.json`
  - 注意：AGENTS.md 开头托管块引用 `llmanspec/`，移除时需同步改写；这些目录在发布日之前仍是活跃工作流，勿提前删

## P1 — 强烈建议

- [ ] ~~`CONTRIBUTING.md` / `SECURITY.md` / `CHANGELOG.md`~~ — **已决定暂不做**（2026-09-09：从发布准备中移除；README 已含开发门禁与文档索引，够用）
- [x] CI（2026-09-09 落地）：`.github/workflows/ci.yml`（静态检查 + server/shared/web/e2e @p0，`oven-sh/setup-bun@v2` + `bun-version-file: package.json`，e2e 全程 mock 可离线）；`.github/workflows/release.yml`（推送 `v*.*.*` tag → 五平台原生矩阵构建 + 冒烟 + 自动 GitHub Release，产出 tar.gz + sha256）
- [x] root `package.json` 增加 `"engines": { "bun": ">=1.4.0" }`
  - Bun 自身目前不强制 `engines`（[oven-sh/bun#12566](https://github.com/oven-sh/bun/issues/12566)、[#5846](https://github.com/oven-sh/bun/issues/5846) 仍为 open feature），但 setup-bun / npm 等外部工具会读取；属低成本文档化最佳实践
- [x] 代理改为环境变量控制：`CL_PROXY_ENABLED`（'true'/'false'）/ `CL_PROXY_HTTP_URL` / `CL_PROXY_HTTPS_URL`，留空跟随 `config/app.yaml`（默认开，保持自托管一致性）
- [x] `CL_CHAT_MODEL` 未设置时启动 preflight fail-fast（server 入口，附配置指引文案；e2e 显式钉住 mock 模型名）
- [x] `.env.example` 头部 legacy 引用清理（生成器 `scripts/gen-env-examples.ts` 已改并重新生成）
- [x] `config/app.yaml` 注释个人主机名中立化（tufa/coral → llama.cpp / OMLX 等通用称呼）

## 已定事项（备忘）

- 语言与受众：中文优先，i18n 留口子给社区
- 许可证：Apache-2.0（已有）；`.github/` 已有 issue/PR 模板
- 首跑体验：未配置聊天模型时 server 拒绝启动并给出中文配置指引（preflight）
