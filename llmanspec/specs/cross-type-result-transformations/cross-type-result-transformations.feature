# language: zh-CN
# capability: cross-type-result-transformations
# purpose: 支持有限、明确、可解释的跨类型结果演化路径：从已有结果触发转换，保留 lineage 与映射边界（保留/重建），并在不支持的路径上回退为重新生成，避免“万物互转”的脆弱承诺。
# scope: src/, tests/

功能: cross-type-result-transformations

  @req:r28 @human
  场景: 系统必须显式声明受支持的跨类型转换路径
    - 系统 MUST 以显式能力清单声明受支持的跨类型转换路径，而不是暗示任意类型都可互转。

  @req:r86 @human
  场景: 跨类型转换必须保留 lineage 与映射边界
    - 系统 MUST 记录跨类型转换的 lineage，并明确保留与丢弃边界。

  @req:r123 @human
  场景: 不受支持的路径必须回退为重新生成
    - 系统 MUST 在不支持直接转换的情况下回退为重新生成，而不是提供不可靠的伪转换。

  @req:r159 @human
  场景: 系统必须提供显式的转换动作并返回新结果
    - 系统 MUST 提供显式的跨类型转换动作，并在成功时返回一个新的结果对象与可追溯的转换记录。

  @req:r194 @human
  场景: 转换请求与结果元数据必须显式表达目标类型与映射摘要
    - 系统 MUST 在转换请求与结果元数据中显式表达目标类型，并提供可理解的映射摘要（保留/重建边界）用于 UI 展示。

  @req:session-get-single @human
  场景: API MUST provide GET single session
    - 系统 MUST 提供 GET 单个 session 端点返回完整 session 信息

  @req:session-convert-citation-chunks @human
  场景: Session convert-to-output MUST collect chunkIds from citations
    - session convert-to-output MUST 从消息 citations 中收集 chunkIds 并附加到创建的 output

  @req:r28 @human
  场景: 用户查看某个结果可执行的转换动作
    - 必须成立：当 用户查看一个已有结果；那么 系统 SHALL 只展示该结果受支持的转换路径
    当 用户查看一个已有结果
    那么 系统 SHALL 只展示该结果受支持的转换路径

  @req:r86 @human
  场景: 用户将一种结果转换为另一种类型
    - 必须成立：当 用户执行一次受支持的跨类型转换；那么 系统 SHALL 记录来源结果与目标结果之间的 lineage
    当 用户执行一次受支持的跨类型转换
    那么 系统 SHALL 记录来源结果与目标结果之间的 lineage

  @req:r123 @human
  场景: 用户尝试执行未定义的转换路径
    - 必须成立：当 用户请求一个未被支持的跨类型转换；那么 系统 SHALL 明确提示该路径不受支持
    当 用户请求一个未被支持的跨类型转换
    那么 系统 SHALL 明确提示该路径不受支持

  @req:r159 @human
  场景: 用户执行一次受支持的转换
    - 必须成立：当 用户从某个结果发起一次受支持的跨类型转换；那么 系统 SHALL 生成目标类型的新结果对象
    当 用户从某个结果发起一次受支持的跨类型转换
    那么 系统 SHALL 生成目标类型的新结果对象

  @req:r194 @human
  场景: ui-展示转换预期
    - 必须成立：当 用户在执行转换前查看该转换的影响；那么 系统 SHALL 能提供该 route 的保留/重建摘要
    当 用户在执行转换前查看该转换的影响
    那么 系统 SHALL 能提供该 route 的保留/重建摘要

  @req:session-get-single @human
  场景: fetch-session
    - 必须成立：假如 一个 session 存在；当 客户端请求 GET 单个 session；那么 系统 SHALL 返回该 session 的完整信息
    假如 一个 session 存在
    当 客户端请求 GET 单个 session
    那么 系统 SHALL 返回该 session 的完整信息

  @req:session-convert-citation-chunks @human
  场景: convert-with-citations
    - 必须成立：假如 session 消息含 citations；当 convert-to-output 调用；那么 系统 SHALL 从 citations 收集 chunkIds 附加到 output
    假如 session 消息含 citations
    当 convert-to-output 调用
    那么 系统 SHALL 从 citations 收集 chunkIds 附加到 output
