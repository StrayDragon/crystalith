# language: zh-CN
# capability: generation-presets-and-constraints
# purpose: 为不同生成类型提供可理解、可复用的预设（presets）与显式约束覆盖（constraints/knobs），使"能生成"升级为"能按意图生成"，并与类型契约保持一致。
# scope: src/, tests/

功能: generation-presets-and-constraints

  @req:r33 @human
  场景: 生成类型必须支持显式预设选择
    - 系统 MUST 允许每种生成类型声明并选择显式预设，以帮助用户稳定启动高价值生成路径。

  @req:r91 @human
  场景: 生成请求必须支持显式约束覆盖
    - 系统 MUST 允许用户在允许范围内以结构化方式覆盖生成约束（如长度、证据要求），而不是只能依赖隐式默认值。

  @req:r128 @human
  场景: 预设与约束不得反向定义生成类型
    - 系统 MUST 保持预设与约束处于“可控生成”层，而不是重写生成类型本身。

  @req:r164 @human
  场景: 预设必须绑定到生成类型（generationTypeId）
    - 系统 MUST 使用 `typed-generation-framework` 的公共词汇把预设绑定到某个生成类型（预设 MUST 显式声明其 `generationTypeId`），避免出现跨类型的隐式耦合。

  @req:r199 @human
  场景: 结果必须回传本次生效的控制配置（effective controls）
    - 系统 MUST 在生成结果中回传本次生效的预设与控制项配置（`presetId` 与控制项值集合），以支持复用与“保存为预设”。
