# language: zh-CN
# capability: typed-generation-framework
# purpose: 把"生成类型"提升为一等对象：定义最小公共词汇、注册与发现语义、请求/结果的类型绑定，以及对下游扩展的边界与扩展位。

功能: typed-generation-framework

  @req:r322
  规则: 系统必须提供生成类型的注册与发现
    系统 MUST 以统一方式注册（内置生成类型在系统启动时装载）并向调用方发现可用的生成类型集合。

    场景: generation-types-registry-discovered-via-tools
      假如 内置生成类型在启动时装入 OUTPUT_META 注册表（workspace-tools-discovery.test.ts）
      当 调用方请求 GET /v2/workspace/tools
      那么 发现的生成类型集合与注册表一一对应（id/kind/label/outputType/prompt/renderDescriptor/frontendBundle 映射一致）
      而且 响应通过 shared WorkspaceToolsListResponseSchema 且 SLIDES 的 enabled 随预览探针可用性降级
  @req:r466

  规则: 前端查询可用生成类型列表
    当前端需要渲染右侧生成入口时，系统 SHALL 提供可用生成类型列表（至少包含 id、displayName、输入要求概览、可选输出类型概览、完成语义概览）。
  
    场景: generation-types-list-endpoint
      假如 generation-types 集成环境就绪（tests/generation/generation-types.test.ts）
      当 请求 GET /v2/generation-types
      那么 响应包含 qa/output/slides 三个类型且每项携带 id/displayName/输入要求概览/允许输出类型概览/默认输出类型/完成语义概览/允许控制项

@req:r323
  规则: 生成请求必须显式绑定生成类型
    系统 MUST 将生成类型作为显式的一等对象，而不是隐含在 prompt 或入口按钮中。
  
    场景: generation-requests-carry-explicit-type-binding
      假如 generation-types 集成环境就绪
      当 检查 qa 与 outputs 生成端点的请求合约
      那么 请求体携带显式 generationTypeId 字段且缺失即被拒绝

@req:r324
  规则: 系统必须按生成类型契约装配请求并做最小校验
    系统 MUST 使用生成类型契约装配默认值并做最小输入要求校验（缺失生成类型标识的请求 MUST 被拒绝），避免类型语义被隐式分叉。
  
    场景: generation-type-assembly-validation
      假如 generation-types 集成环境就绪
      当 以缺失、未知或错配的 generationTypeId 调用 qa 与 outputs 生成端点
      那么 请求被确定性拒绝且错配响应的 details 标注 expected 归属类型

@req:r467

  规则: 请求未指定输出类型
    当生成请求已指定生成类型但未显式指定输出类型时，系统 SHALL 使用该类型契约的默认输出类型装配请求。
  
    场景: default-output-type-from-contract
      假如 generation-types 集成环境就绪
      当 以 generationTypeId=output 且不携带 type 发起生成
      那么 创建的输出使用注册表默认输出类型 PARAGRAPH

@req:r325
  规则: 生成类型必须声明最小类型契约
    系统 MUST 为每种生成类型声明最小契约（至少输入要求、输出结构、控制面与完成语义），以支撑后续控制项、结果结构和完成语义。
  
    场景: minimal-contract-declared-per-type
      假如 generation-types 集成环境就绪
      当 读取 GET /v2/generation-types 的每一项
      那么 每种生成类型都声明了输入要求、输出结构（allowedOutputTypes/defaultOutputType）、控制面（allowedControls）与完成语义

@req:r326
  规则: 生成结果必须回传生成类型、输出类型与完成语义元数据
    系统 MUST 在结果对象中同时回传生成类型与输出类型，并回传完成语义相关元数据以支撑治理与后续工作流。
  
    场景: generation-metadata-echo
      假如 generation-types 集成环境就绪
      当 分别发起 qa 与 outputs 生成并读取结果对象
      那么 qa 响应与 stream done 事件回传 generation 元数据（类型/输出类型/完成语义/presetId/有效控制项）
      而且 outputs 行级 generationMeta 落库并在后续 GET 中保持可读

@req:r327
  规则: 生成类型与输出类型必须保持边界分离
    系统 MUST 保持生成类型与输出类型的边界清晰，避免一个概念吞掉另一个概念。
  
    场景: generation-and-output-type-vocabularies-stay-separate
      假如 generation-types 集成环境就绪
      当 对照注册表中 qa 与 output 两个生成类型的输出类型面
      那么 qa 的 outputType 为 MESSAGE 而 outputs 的 generationTypeId 为 output（两个词汇不互吞且 SLIDES 归 slides 专属端点）

@req:r328
  规则: 下游扩展只能使用扩展位，禁止反向改写公共词汇
    系统 MUST 为下游能力提供明确扩展位（如 controlSurface knobs/presets），同时禁止下游能力反向改写公共词汇定义。
  @req:r329
  规则: Outputs pipeline MUST sanitize citation indices (range/dup/int) with warnings
    outputs pipeline MUST 递归剥离越界、重复、非整数 citation 索引，并设置 _warnings / citations_sanitized / _postprocessed 标记。本条为 generation-core r165（canonical）行为的实现级细化：剥离准则与内容标记命名归此承载，管线阶段顺序以 canonical 为准。

    场景: citation-indices-sanitized
      假如 outputs pipeline 收到带 citation 索引的生成结果
      当 sanitizeCitationsIndices 以引用池上界执行剥离
      那么 越界、重复、非整数索引被递归剥离
      而且 发生剥离时设置 _warnings 与 citations_sanitized / _postprocessed 标记
  @req:r330
  规则: Outputs pipeline with preference=quality MUST run LLM repair loop for salvageable output
    outputs pipeline 在 preference=quality 且 needsRepair 为真时 MUST 再跑一次生成修补以挽救可挽救输出；失败则保留原对象并走后续 postprocess/fallback；修补所处的管线阶段顺序见 generation-core r160/r165。

    场景: quality-preference-runs-repair-loop
      假如 mock 生成器首次产出 needsRepair 为真的不完整对象（repair-loop.test.ts）
      当 以 preference=quality 运行 outputs pipeline
      那么 第二次生成产出完整对象时被接受且不再有 _fallback
      而且 修补抛错或仍不完整时保留原对象走 fallback、preference=speed 则只跑一次生成
