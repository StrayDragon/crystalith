# 开源发布前 Checklist

> 汇总 2026-09-07 开源准备梳理的结论与决定。发布前逐项勾选；已完成项保留记录。

## P0 — 发布阻塞项

- [ ] **Git 历史清洗（密钥泄露）**
  - 泄露内容：`sk-WeJOLb…`（局域网 llama.cpp 网关 key，对应 host `gateway.lan:50256/v1`，即现 tufa 那台机器，非云服务凭据）
  - 涉及提交：`cbbeed87`（2026-01-13，写入 `config/app.yaml`）→ `20a7fa9d`（2026-02-11，改为 env 注入时移除）
  - 已核查：当前在用的 `CL_CHAT_API_KEY` / `CL_EMBEDDING_API_KEY` **均未进过历史**；tracked 文件无密钥；`data/`、`.env`、`config/secret.env` 均被正确 ignore
  - 步骤：
    1. 若那台 llama-server 仍配置该 `--api-key`，先轮换
    2. `git filter-repo --replace-text`（replace 规则含该 key 与 `gateway.lan`），或以全新 squash 历史发布
- [ ] **README 重写**（已决定延后到发布前最后梳理）
  - 现状仅 4 行占位；需补：项目简介 / 截图 / quickstart / 环境要求（Bun、overmind+tmux、LLM 网关配置指引）
  - 语言：**中文优先**（已决定）；i18n 留口子，后续交社区
- [ ] **内部 SDD 机制清理**（已决定清理，发布时执行）
  - 涉及：`llmanspec/`、`_archive/`、`.agents/skills/`、`CLAUDE.md`、`skills-lock.json`
  - 注意：AGENTS.md 开头托管块引用 `llmanspec/`，移除时需同步改写；这些目录在发布日之前仍是活跃工作流，勿提前删

## P1 — 强烈建议

- [ ] `CONTRIBUTING.md` / `SECURITY.md` / `CHANGELOG.md`（与 README 同批延后）
- [ ] CI：**已决定暂不添加**（开源前不消耗 Actions 额度）；开源后建议 `oven-sh/setup-bun`（支持 `bun-version-file: package.json`）跑 `just qa` 等效子集——e2e 全程 mock 网关，可离线跑
- [ ] （可选）root `package.json` 增加 `"engines": { "bun": ">=<当前版本>" }`
  - Bun 自身目前不强制 `engines`（[oven-sh/bun#12566](https://github.com/oven-sh/bun/issues/12566)、[#5846](https://github.com/oven-sh/bun/issues/5846) 仍为 open feature），但 setup-bun / npm 等外部工具会读取；属低成本文档化最佳实践
- [x] 代理改为环境变量控制：`CL_PROXY_ENABLED`（'true'/'false'）/ `CL_PROXY_HTTP_URL` / `CL_PROXY_HTTPS_URL`，留空跟随 `config/app.yaml`（默认开，保持自托管一致性）
- [x] `CL_CHAT_MODEL` 未设置时启动 preflight fail-fast（server 入口，附配置指引文案；e2e 显式钉住 mock 模型名）
- [x] `.env.example` 头部 legacy 引用清理（生成器 `scripts/gen-env-examples.ts` 已改并重新生成）
- [x] `config/app.yaml` 注释个人主机名中立化（tufa/coral → llama.cpp / OMLX 等通用称呼）

## 已定事项（备忘）

- 语言与受众：中文优先，i18n 留口子给社区
- 许可证：Apache-2.0（已有）；`.github/` 已有 issue/PR 模板
- 首跑体验：未配置聊天模型时 server 拒绝启动并给出中文配置指引（preflight）
