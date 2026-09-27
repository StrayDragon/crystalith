# language: zh-CN
# capability: public-repo-hygiene
# purpose: 定义 Crystalith 公开仓库最小工程化基线：文档可发现性、贡献路径、安全披露、Issue/PR 模板与元数据一致性。SECURITY.md 当前 DEFERRED（见进度 P6.2）。
# scope: ./, docs/

功能: public-repo-hygiene

  @req:r208
  规则: Repo provides a clear contribution entrypoint
    仓库 MUST 提供可发现的贡献入口（`README.md` + `AGENTS.md`；或 `CONTRIBUTING.md` 等价物），并包含最小开发/测试/提交指导。

    场景: contribution-entrypoint-present
      假如 检查仓库根目录的贡献入口文件
      当 运行 apps/server/tests/meta/repo-hygiene.test.ts 的 contribution entrypoint 用例
      那么 README.md 与 AGENTS.md 存在且非空
      而且 README 给出安装/开发/just qa 指导且 AGENTS.md 含 Commit Guidelines
  @req:r209
  规则: Repo provides a security disclosure policy
    DEFERRED(P6.2)：仓库 MUST 提供 `SECURITY.md`（或等价安全策略）并说明漏洞报告渠道与响应边界。在落地前 MUST NOT 将本条当作已满足的门禁。
  @req:r210
  规则: Issue and PR templates capture actionable information
    仓库 MUST 提供最小的 Issue/PR 模板，以引导提交者提供复现步骤、期望/实际与环境信息，从而减少维护者追问。

    场景: issue-pr-templates-actionable
      假如 检查 .github 的 PR 与 issue 模板
      当 运行 repo-hygiene.test.ts 的 templates 用例
      那么 PR 模板含 Testing 勾选段（含 just qa 本地自检项）
      而且 bug/feature issue 模板收集复现步骤、期望与实际结果、环境信息
  @req:r211
  规则: Project metadata is not placeholder and is consistent
    项目元数据（README、包描述、文档首页等）MUST 避免占位文本，并对“项目是什么/如何运行/如何获取帮助”给出一致表述。
  @req:r212
  规则: Release artifacts are self-contained and key-free
    发布工件（just release 产出的压缩包）MUST 包含运行所需的最小资源集（server 二进制、web 静态资源、数据库迁移、sqlite-vec 平台扩展、config/app.yaml），MUST NOT 包含任何密钥文件（如 config/secret.env）；README 的获取/运行说明 MUST 与工件实际布局保持一致；版本号 MUST 以发布 git tag 为单一来源并注入 /health 与 OpenAPI 文档。

    场景: release-archive-self-contained-key-free
      假如 打开 scripts/build-release.ts 与 README 部署段
      当 运行 repo-hygiene.test.ts 的 release artifacts 用例
      那么 工件覆盖 server 二进制、web/dist、drizzle、native/vec0 与显式 allowlist 内的 config（app.yaml / app.schema.gen.json）
      而且 config 经 allowlist 拷贝不携带 secret 文件，README 布局与「版本号来自发布 tag」说明一致
