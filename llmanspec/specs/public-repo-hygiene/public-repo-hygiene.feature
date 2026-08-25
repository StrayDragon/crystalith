# language: zh-CN
# capability: public-repo-hygiene
# purpose: 定义 Crystalith 公开仓库最小工程化基线：文档可发现性、贡献路径、安全披露、Issue/PR 模板与元数据一致性。SECURITY.md 当前 DEFERRED（见进度 P6.2）。
# scope: ./, docs/

功能: public-repo-hygiene

  @req:r39 @human
  场景: Repo provides a clear contribution entrypoint
    - 仓库 MUST 提供可发现的贡献入口（`README.md` + `AGENTS.md`；或 `CONTRIBUTING.md` 等价物），并包含最小开发/测试/提交指导。

  @req:r97 @human
  场景: Repo provides a security disclosure policy
    - DEFERRED(P6.2)：仓库 MUST 提供 `SECURITY.md`（或等价安全策略）并说明漏洞报告渠道与响应边界。在落地前 MUST NOT 将本条当作已满足的门禁。

  @req:r134 @human
  场景: Issue and PR templates capture actionable information
    - 仓库 MUST 提供最小的 Issue/PR 模板，以引导提交者提供复现步骤、期望/实际与环境信息，从而减少维护者追问。

  @req:r170 @human
  场景: Project metadata is not placeholder and is consistent
    - 项目元数据（README、包描述、文档首页等）MUST 避免占位文本，并对“项目是什么/如何运行/如何获取帮助”给出一致表述。

  @req:r39 @human
  场景: new-contributor-finds-how-to-run-tests
    - 必须成立：当 新贡献者打开仓库并希望验证改动；那么 文档 SHALL 提供可执行的测试命令与最小开发步骤
    当 新贡献者打开仓库并希望验证改动
    那么 文档 SHALL 提供可执行的测试命令与最小开发步骤

  @req:r97 @human
  场景: reporter-can-find-security-contact
    - 必须成立：当 安全研究者需要报告漏洞；那么 仓库 SHALL 提供清晰的披露渠道与期望信息
    当 安全研究者需要报告漏洞
    那么 仓库 SHALL 提供清晰的披露渠道与期望信息

  @req:r134 @human
  场景: bug-report-template-includes-reproduction-details
    - 必须成立：当 用户提交 bug；那么 模板 SHALL 引导其提供复现步骤与运行环境（local/compose 等）
    当 用户提交 bug
    那么 模板 SHALL 引导其提供复现步骤与运行环境（local/compose 等）

  @req:r170 @human
  场景: user-sees-consistent-positioning-across-entrypoints
    - 必须成立：当 用户分别查看 README 与包元数据/文档入口；那么 项目定位与快速开始说明 SHALL 保持一致且可操作
    当 用户分别查看 README 与包元数据/文档入口
    那么 项目定位与快速开始说明 SHALL 保持一致且可操作
