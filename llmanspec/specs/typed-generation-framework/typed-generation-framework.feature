# language: zh-CN
# capability: typed-generation-framework
# purpose: 把"生成类型"提升为一等对象：定义最小公共词汇、注册与发现语义、请求/结果的类型绑定，以及对下游扩展的边界与扩展位。
# scope: src/, tests/

功能: typed-generation-framework

  @req:r54 @human
  场景: 系统必须提供生成类型的注册与发现
    - 系统 MUST 以统一方式注册并向调用方发现可用的生成类型集合。

  @req:r112 @human
  场景: 生成请求必须显式绑定生成类型
    - 系统 MUST 将生成类型作为显式的一等对象，而不是隐含在 prompt 或入口按钮中。

  @req:r149 @human
  场景: 系统必须按生成类型契约装配请求并做最小校验
    - 系统 MUST 使用生成类型契约装配默认值并做最小输入要求校验，避免类型语义被隐式分叉。

  @req:r184 @human
  场景: 生成类型必须声明最小类型契约
    - 系统 MUST 为每种生成类型声明最小契约，以支撑后续控制项、结果结构和完成语义。

  @req:r216 @human
  场景: 生成结果必须回传生成类型、输出类型与完成语义元数据
    - 系统 MUST 在结果对象中同时回传生成类型与输出类型，并回传完成语义相关元数据以支撑治理与后续工作流。

  @req:r243 @human
  场景: 生成类型与输出类型必须保持边界分离
    - 系统 MUST 保持生成类型与输出类型的边界清晰，避免一个概念吞掉另一个概念。

  @req:r261 @human
  场景: 下游扩展只能使用扩展位，禁止反向改写公共词汇
    - 系统 MUST 为下游能力提供明确扩展位（如 controlSurface knobs/presets），同时禁止下游能力反向改写公共词汇定义。

  @req:outputs-citations-must-be-sanitized @human
  场景: Outputs pipeline MUST sanitize citation indices (range/dup/int) with warnings
    - outputs pipeline MUST 递归剥离越界、重复、非整数 citation 索引，并设置 _warnings / citations_sanitized / _postprocessed 标记（对齐既有语义）。

  @req:outputs-quality-preference-must-trigger-llm-repair @human
  场景: Outputs pipeline with preference=quality MUST run LLM repair loop for salvageable output
    - outputs pipeline 在 preference=quality 且 needsRepair 为真时 MUST 再跑一次生成修补可挽救输出；失败则保留原对象并走后续 postprocess/fallback。

  @req:r54 @human
  场景: 系统启动时装载内置生成类型
    - 必须成立：当 系统启动；那么 系统 SHALL 将内置生成类型注册到统一 registry
    当 系统启动
    那么 系统 SHALL 将内置生成类型注册到统一 registry

  @req:r54 @human
  场景: 前端查询可用生成类型列表
    - 必须成立：当 前端需要渲染右侧生成入口；那么 系统 SHALL 提供可用生成类型列表（至少包含 id、displayName、输入要求概览、可选输出类型概览、完成语义概览）
    当 前端需要渲染右侧生成入口
    那么 系统 SHALL 提供可用生成类型列表（至少包含 id、displayName、输入要求概览、可选输出类型概览、完成语义概览）

  @req:r112 @human
  场景: 用户发起某一类生成
    - 必须成立：当 用户发起一次生成请求；那么 该请求 SHALL 显式指向一个生成类型
    当 用户发起一次生成请求
    那么 该请求 SHALL 显式指向一个生成类型

  @req:r149 @human
  场景: 请求未携带生成类型
    - 必须成立：当 某个生成请求缺失生成类型标识；那么 系统 SHALL 拒绝该请求
    当 某个生成请求缺失生成类型标识
    那么 系统 SHALL 拒绝该请求

  @req:r149 @human
  场景: 请求未指定输出类型
    - 必须成立：当 生成请求已指定生成类型但未显式指定输出类型；那么 系统 SHALL 使用该类型契约的默认输出类型装配请求
    当 生成请求已指定生成类型但未显式指定输出类型
    那么 系统 SHALL 使用该类型契约的默认输出类型装配请求

  @req:r184 @human
  场景: 系统注册一个生成类型
    - 必须成立：当 系统新增或加载某个生成类型；那么 该类型 SHALL 至少声明输入要求、输出结构、控制面与完成语义
    当 系统新增或加载某个生成类型
    那么 该类型 SHALL 至少声明输入要求、输出结构、控制面与完成语义

  @req:r216 @human
  场景: 生成完成并返回结果
    - 必须成立：当 某个生成请求完成并返回结果；那么 结果 SHALL 回传其生成类型标识与输出类型标识
    当 某个生成请求完成并返回结果
    那么 结果 SHALL 回传其生成类型标识与输出类型标识

  @req:r243 @human
  场景: 结果被渲染为某种输出形式
    - 必须成立：当 某个生成结果被渲染或承载；那么 系统 SHALL 能区分其生成类型与输出类型
    当 某个生成结果被渲染或承载
    那么 系统 SHALL 能区分其生成类型与输出类型

  @req:r261 @human
  场景: 下游能力需要为某些生成类型增加控制项
    - 必须成立：当 下游能力需要为部分生成类型增加 knobs/presets 等控制项；那么 该能力 SHALL 通过公共框架的扩展位表达（如 controlSurface）
    当 下游能力需要为部分生成类型增加 knobs/presets 等控制项
    那么 该能力 SHALL 通过公共框架的扩展位表达（如 controlSurface）

  @req:outputs-citations-must-be-sanitized @human
  场景: citation-out-of-range
    - 必须成立：假如 生成 content 含越界 citation 索引（如 [99] 但只有 3 个 citation）；当 系统 postprocess；那么 SHALL 剥离越界索引并设 _postprocessed/_warnings 标记（与既有语义一致）
    假如 生成 content 含越界 citation 索引（如 [99] 但只有 3 个 citation）
    当 系统 postprocess
    那么 SHALL 剥离越界索引并设 _postprocessed/_warnings 标记（与既有语义一致）

  @req:outputs-quality-preference-must-trigger-llm-repair @human
  场景: quality-repair
    - 必须成立：假如 preference=quality 且输出有可修补的缺字段；当 系统 postprocess；那么 SHALL 触发修补尝试而非直接 fallback
    假如 preference=quality 且输出有可修补的缺字段
    当 系统 postprocess
    那么 SHALL 触发修补尝试而非直接 fallback
