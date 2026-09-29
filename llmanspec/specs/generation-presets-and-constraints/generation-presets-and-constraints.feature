# language: zh-CN
# capability: generation-presets-and-constraints
# purpose: 为不同生成类型提供可理解、可复用的预设（presets）与显式约束覆盖（constraints/knobs），使"能生成"升级为"能按意图生成"，并与类型契约保持一致。
# scope: apps/server/src/features/qa/, apps/server/src/features/outputs/

功能: generation-presets-and-constraints

  @req:r185
  规则: 生成类型必须支持显式预设选择
    系统 MUST 允许每种生成类型声明并选择显式预设，以帮助用户稳定启动高价值生成路径。

    场景: explicit-preset-selection
      假如 生成类型已声明可用预设（如 stats）
      当 parsePromptDirective 解析输入中的 /prompt: 指令
      那么 请求按显式预设 id（大小写归一）选择对应预设
      而且 无指令时回退到请求体内声明的 preset
  @req:r186
  规则: 生成请求必须支持显式约束覆盖
    系统 MUST 允许用户在允许范围内以结构化方式覆盖生成约束（如长度、证据要求），而不是只能依赖隐式默认值。
  
    场景: structured-constraint-overrides
      假如 generation-types 集成环境就绪（tests/generation/generation-types.test.ts）
      当 携带 controls（lengthHint/requireCitations）发起 qa 生成
      那么 约束以指令形式注入 system prompt 且结果回传 effectiveControls 集合

@req:r187
  规则: 预设与约束不得反向定义生成类型
    系统 MUST 保持预设与约束处于“可控生成”层，而不是重写生成类型本身。
  @req:r188
  规则: 预设必须绑定到生成类型（generationTypeId）
    系统 MUST 使用 `typed-generation-framework` 的公共词汇把预设绑定到某个生成类型（预设 MUST 显式声明其 `generationTypeId`），避免出现跨类型的隐式耦合。
  
    场景: presets-bind-generation-type
      假如 prompt-presets 集成环境就绪
      当 创建携带 generationTypeId 的预设并以预设不支持的类型再创建一个
      那么 创建成功并回传 generationTypeId=qa 且不支持的类型被 400 拒绝并列出支持类型

@req:r189
  规则: 结果必须回传本次生效的控制配置（effective controls）
    系统 MUST 在生成结果中回传本次生效的预设与控制项配置（`presetId` 与控制项值集合），以支持复用与“保存为预设”。
    场景: effective-preset-and-controls-echo
      假如 generation-types 集成环境就绪
      当 以 preset=analysis 与 controls 发起 qa 生成
      那么 结果 generation 元数据回传 presetId 与本次生效的控制项值集合


