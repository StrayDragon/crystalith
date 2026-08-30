# language: zh-CN
# capability: source-aware-generation-modes
# purpose: 为不同生成类型定义清晰、可解释的来源使用模式（source_mode），让检索、citation 预期、来源展示与结果元数据形成一致语义，并避免把内部策略术语直接暴露为产品标签。
# scope: apps/server/src/features/qa/, apps/server/src/features/outputs/

功能: source-aware-generation-modes

  @req:r45 @human
  场景: 生成类型必须能够声明来源使用模式
    - 系统 MUST 允许生成类型声明其来源使用模式（如注册需要强证据支持的类型时声明对应模式），以表达不同的来源依赖预期。

  @req:r103 @human
  场景: 来源模式必须影响 citation 与来源展示预期
    - 系统 MUST 让来源模式影响 citation 行为和来源展示边界：采用不同来源模式的结果 SHALL 在 citation 预期或来源展示上体现差异，而不是只作为内部策略标签存在。

  @req:r140 @human
  场景: 来源模式不得反向重写上游对象模型
    - 系统 MUST 将来源模式建立在稳定的生成类型和来源对象语义之上（新增或调整模式 SHALL 消费既有类型与来源对象模型），而不是借此重写上游定义。

  @req:r175 @human
  场景: 生成请求与结果必须显式表达生效的来源模式
    - 系统 MUST 在生成请求与结果元数据中显式表达本次生效的来源模式：客户端显式指定模式时 MUST 校验该模式被该生成类型允许，结果元数据 SHALL 回传实际生效的模式，以支持可解释行为与一致的 UI 呈现。

  @req:r207 @human
  场景: 来源模式必须影响检索与上下文构造行为
    - 系统 MUST 让来源模式影响检索、上下文构造与证据约束行为，而不是只改变展示文案。

  @req:r207 @human
  场景: 不同来源模式下的生成行为差异
    - 以 strict_evidence 模式执行生成时，系统 SHALL 以可引用的来源片段构造上下文并强制 citation 预期；以 brainstorming 模式执行时，系统 SHALL 允许在不强制 citation 的前提下生成。

  @req:r235 @human
  场景: 用户可见的来源模式标签不得直接暴露内部策略术语
    - 系统 MUST 使用可理解的产品概念向用户表达来源模式：UI 展示某次结果的来源依赖方式时 SHALL 使用用户可理解的来源模式标签与解释文案，而不是把内部策略术语直接当作产品标签。
