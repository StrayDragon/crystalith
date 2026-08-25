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
    - 系统 MUST 允许用户在允许范围内覆盖生成约束，而不是只能依赖隐式默认值。

  @req:r128 @human
  场景: 预设与约束不得反向定义生成类型
    - 系统 MUST 保持预设与约束处于"可控生成"层，而不是重写生成类型本身。

  @req:r164 @human
  场景: 预设必须绑定到生成类型（generationTypeId）
    - 系统 MUST 使用 `typed-generation-framework` 的公共词汇把预设绑定到某个生成类型，避免出现跨类型的隐式耦合。

  @req:r199 @human
  场景: 结果必须回传本次生效的控制配置（effective controls）
    - 系统 MUST 在生成结果中回传本次生效的预设与控制项配置，以支持复用与"保存为预设"。

  @req:r33 @human
  场景: 用户选择某类生成的预设
    - 必须成立：当 用户准备发起某个生成类型；那么 系统 SHALL 展示该类型可用的预设
    当 用户准备发起某个生成类型
    那么 系统 SHALL 展示该类型可用的预设

  @req:r91 @human
  场景: 用户调整生成约束
    - 必须成立：当 用户选择某个预设后继续调整长度或证据要求；那么 系统 SHALL 接收结构化约束覆盖
    当 用户选择某个预设后继续调整长度或证据要求
    那么 系统 SHALL 接收结构化约束覆盖

  @req:r128 @human
  场景: 新增某个生成类型的预设
    - 必须成立：当 系统为一种已有生成类型新增预设；那么 该变更 SHALL 建立在既有类型契约之上
    当 系统为一种已有生成类型新增预设
    那么 该变更 SHALL 建立在既有类型契约之上

  @req:r164 @human
  场景: 系统加载某个预设
    - 必须成立：当 系统加载或创建某个预设；那么 该预设 SHALL 显式声明其绑定的 `generationTypeId`
    当 系统加载或创建某个预设
    那么 该预设 SHALL 显式声明其绑定的 `generationTypeId`

  @req:r199 @human
  场景: 用户希望复用一次效果较好的生成
    - 必须成立：当 用户查看某次生成结果并希望复用其配置；那么 系统 SHALL 回传该次生效的 `presetId` 与控制项值集合
    当 用户查看某次生成结果并希望复用其配置
    那么 系统 SHALL 回传该次生效的 `presetId` 与控制项值集合
