# language: zh-CN
# capability: knowledge-curation-and-freshness
# purpose: 为长期知识库提供治理信号与维护建议：freshness（新鲜度/过时风险）、duplicate candidates（重复候选）、maintenance suggestions（维护建议）与显式动作（ignore/re_ingest/re_embed/review），避免知识库随时间劣化。
# scope: src/, tests/

功能: knowledge-curation-and-freshness

  @req:r35 @human
  场景: 来源对象必须暴露 freshness 信号
    - 系统 MUST 为接入后的来源对象提供 freshness 信号，以支持长期维护。

  @req:r93 @human
  场景: 系统必须提供重复候选而不是自动合并
    - 系统 MUST 以候选形式呈现重复内容判断，而不是直接自动合并对象。

  @req:r130 @human
  场景: 维护建议必须显式触发后续动作
    - 系统 MUST 将维护建议与后续动作解耦，避免治理信号直接隐式改写来源状态。

  @req:r166 @human
  场景: 治理信号必须绑定到稳定的来源对象（source-scoped）
    - 系统 MUST 将 freshness 与 duplicate 等治理信号绑定到稳定的来源对象标识，而不是绑定到一次性的导入请求或临时 UI 状态。

  @req:r201 @human
  场景: 系统必须提供显式动作以处理治理建议
    - 系统 MUST 提供显式动作来处理 freshness/duplicate 建议（例如 ignore、re_ingest、re_embed、review），并在触发后产生可追踪的处理结果。

  @req:r230 @human
  场景: 工作区必须提供可聚合查看的治理入口
    - 系统 MUST 在工作区/来源管理界面提供治理入口，聚合展示 stale sources、duplicate candidates 与维护建议，避免治理能力藏在单个来源详情里。

  @req:r35 @human
  场景: 用户查看某个来源是否过旧
    - 必须成立：当 用户查看已接入的来源对象；那么 系统 SHALL 能返回该对象的 freshness 状态或提示
    当 用户查看已接入的来源对象
    那么 系统 SHALL 能返回该对象的 freshness 状态或提示

  @req:r93 @human
  场景: 系统发现高相似来源
    - 必须成立：当 系统识别出可能重复的来源对象；那么 系统 SHALL 返回 duplicate candidates
    当 系统识别出可能重复的来源对象
    那么 系统 SHALL 返回 duplicate candidates

  @req:r130 @human
  场景: 用户处理维护建议
    - 必须成立：当 用户收到某个来源的维护建议；那么 系统 SHALL 明确该建议对应的可选动作
    当 用户收到某个来源的维护建议
    那么 系统 SHALL 明确该建议对应的可选动作

  @req:r166 @human
  场景: 用户跨会话查看同一来源的治理状态
    - 必须成立：当 用户在不同时间打开同一个来源对象；那么 系统 SHALL 能返回该来源对象的 freshness 信号与重复候选状态
    当 用户在不同时间打开同一个来源对象
    那么 系统 SHALL 能返回该来源对象的 freshness 信号与重复候选状态

  @req:r201 @human
  场景: 用户忽略某条治理建议
    - 必须成立：当 用户对某个来源的维护建议执行 ignore；那么 系统 SHALL 记录该忽略状态
    当 用户对某个来源的维护建议执行 ignore
    那么 系统 SHALL 记录该忽略状态

  @req:r201 @human
  场景: 用户触发重新导入或重新嵌入
    - 必须成立：当 用户对某个来源触发 re_ingest 或 re_embed；那么 系统 SHALL 以后台任务形式执行该动作或返回可追踪的执行引用
    当 用户对某个来源触发 re_ingest 或 re_embed
    那么 系统 SHALL 以后台任务形式执行该动作或返回可追踪的执行引用

  @req:r230 @human
  场景: 用户在工作区查看需要维护的来源
    - 必须成立：当 用户进入来源管理或治理入口；那么 系统 SHALL 能展示 stale sources 列表与重复候选列表
    当 用户进入来源管理或治理入口
    那么 系统 SHALL 能展示 stale sources 列表与重复候选列表
