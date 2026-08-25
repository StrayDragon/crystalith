# language: zh-CN
# capability: cross-type-result-transformations
# purpose: 支持有限、明确、可解释的跨类型结果演化路径：从已有结果触发转换，保留 lineage 与映射边界（保留/重建），并在不支持的路径上回退为重新生成，避免“万物互转”的脆弱承诺。
# scope: src/, tests/

功能: cross-type-result-transformations

  @req:r28 @human
  场景: 系统必须显式声明受支持的跨类型转换路径
    - 系统 MUST 以显式能力清单声明受支持的跨类型转换路径，且对已有结果 SHALL 只展示该结果受支持的转换动作，而不是暗示任意类型都可互转。

  @req:r86 @human
  场景: 跨类型转换必须保留 lineage 与映射边界
    - 本条为转换 lineage 的 canonical 约束。系统 MUST 记录跨类型转换中来源结果与目标结果之间的 lineage，并明确保留与丢弃边界。

  @req:r123 @human
  场景: 不受支持的路径必须回退为重新生成
    - 系统 MUST 在不支持直接转换的情况下回退为重新生成，并向用户明确提示该路径不受支持，而不是提供不可靠的伪转换。

  @req:r159 @human
  场景: 系统必须提供显式的转换动作并返回新结果
    - 本条为显式转换动作的 canonical 约束。系统 MUST 提供显式的跨类型转换动作，并在成功时返回目标类型的新结果对象与可追溯的转换记录。

  @req:r194 @human
  场景: 转换请求与结果元数据必须显式表达目标类型与映射摘要
    - 系统 MUST 在转换请求与结果元数据中显式表达目标类型；用户执行转换前查看影响时 SHALL 能获得该 route 的保留/重建映射摘要用于 UI 展示。

  @req:session-get-single @human
  场景: API MUST provide GET single session
    - 系统 MUST 提供 GET 单个 session 端点返回完整 session 信息

  @req:session-convert-citation-chunks @human
  场景: Session convert-to-output MUST collect chunkIds from citations
    - session convert-to-output MUST 从消息 citations 中收集 chunkIds 并附加到创建的 output
