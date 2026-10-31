# language: zh-CN
# capability: slides-workflow-plugins
# purpose: 定义 slides workflow plugin 的宿主/插件契约：生成阶段边界、active plugin 选择、预览与前端声明模型，以及官方参考插件的稳定样板。

功能: slides-workflow-plugins

  @req:r236
  规则: Slides workflow plugin is a first-class contract
    宿主 MUST 提供一类独立的 slides workflow plugin 契约，用于承载 slides 的默认配置、outline 生成、markdown 生成、preview 声明与前端 bundle 元数据，而不是将这些能力隐式塞入其他插件接口。宿主发现并加载实现该契约的插件时，SHALL 将其注册为 slides workflow 候选。 该契约至少 SHOULD 支持： - metadata（显示文案、tone 等） - `configSchema`（defaults + rich options） - `generate_outline(...)` - `generate_markdown(...)` - `previewDescriptor`（若插件支持预览） - `frontendBundle`（若插件提供专用前端渲染）

    场景: slides-plugin-contract-surface-is-complete
      假如 宿主发现实现 slides workflow 契约的插件
      当 检查其契约面
      那么 metadata 与 configSchema（defaults + rich options）可用
      而且 generate_outline 与 generate_markdown 可用
      而且 previewDescriptor 与 frontendBundle 按插件能力可选
  @req:r237
  规则: Slides workflow activation is single-active and deterministic
    对 `SLIDES` 业务能力，宿主 MUST 在任一时刻仅选择一个 active slides workflow plugin 对外生效，并保证选择结果可预测、可诊断。 选择规则 MUST 满足： - 若配置了 `slides.default_plugin`，则优先按该 plugin id 选择 - 若未配置且仅发现一个兼容候选，则可自动选择 - 若未配置且候选为 0 或大于 1，则 MUST 返回结构化诊断而不是静默选取

    场景: default-plugin-wins-when-configured
      假如 配置了 slides.default_plugin 指向已注册插件
      当 解析 active slides workflow plugin
      那么 按该 plugin id 选中且仅一个 active 生效

    场景: ambiguous-candidates-return-structured-diagnostics
      假如 未配置 slides.default_plugin
      当 兼容候选为 0 个或大于 1 个时解析 active plugin
      那么 返回结构化诊断而非静默选取
  @req:r238
  规则: Repository provides an official reference slides plugin
    仓库 MUST 提供一个官方 reference plugin，作为“复杂工作流插件”的样板，实现 slides workflow contract 的完整子集并附带安装/启用说明；运维安装并启用后，`/v2/workspace/tools` SHALL 能通过 active plugin 暴露 `SLIDES` tool。 该 reference plugin MUST： - 使用稳定命名（如 `slides-slidev`） - 暴露 rich `configSchema`、preview contract 与 frontend bundle metadata - 作为官方文档中的自托管安装示例与二次开发参考

    场景: official-reference-plugin-exists
      假如 仓库检出完整
      当 检查官方 reference plugin
      那么 存在稳定命名（如 slides-slidev）的插件
      而且 暴露 rich configSchema、preview contract 与 frontend bundle metadata
