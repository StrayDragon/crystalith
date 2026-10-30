# language: zh-CN
# capability: slides-workflow-plugins
# purpose: 定义 slides workflow plugin 的宿主/插件契约：生成阶段边界、active plugin 选择、预览与前端声明模型，以及官方参考插件的稳定样板。

功能: slides-workflow-plugins

  @req:r236
  规则: Slides workflow plugin is a first-class contract
    宿主 MUST 提供独立的 slides workflow plugin 契约面（当前以 configSchema 为 MUST，outline/markdown 生成等其余面为 SHOULD，随实现扩展逐步收紧）。契约面收窄为 buildSlidesConfigSchema 时，configSchema 的 rich options（defaults + 自定义段）MUST 完整可用。
  @req:r237
  规则: Slides workflow activation is single-active and deterministic
    当前实现固定选择 slides-slidev 为唯一 active plugin（implOf 定值）；多候选选择器与歧义诊断为后续扩展位，落地后本条收紧。
  @req:r238
  规则: Repository provides an official reference slides plugin
    仓库 MUST 提供一个官方 reference plugin，作为“复杂工作流插件”的样板，实现 slides workflow contract 的完整子集并附带安装/启用说明；运维安装并启用后，`/v2/workspace/tools` SHALL 能通过 active plugin 暴露 `SLIDES` tool。 该 reference plugin MUST： - 使用稳定命名（如 `slides-slidev`） - 暴露 rich `configSchema`、preview contract 与 frontend bundle metadata - 作为官方文档中的自托管安装示例与二次开发参考

    场景: official-reference-plugin-exists
      假如 仓库检出完整
      当 检查官方 reference plugin
      那么 存在稳定命名（如 slides-slidev）的插件
      而且 暴露 rich configSchema、preview contract 与 frontend bundle metadata
