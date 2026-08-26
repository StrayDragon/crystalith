# language: zh-CN
# capability: knowledge-curation-and-freshness
# purpose: 为长期知识库提供治理信号与维护建议：freshness（新鲜度/过时风险）、duplicate candidates（重复候选）、maintenance suggestions（维护建议）与显式动作（ignore/re_ingest/re_embed/review），避免知识库随时间劣化。
# scope: src/, tests/

功能: knowledge-curation-and-freshness

  @req:r35 @human
  场景: 来源对象必须暴露 freshness 信号
    - 系统 MUST 为接入后的来源对象提供 freshness 信号：用户查看已接入来源时 SHALL 能获得其 freshness 状态或提示，以支持长期维护。

  @req:r93 @human
  场景: 系统必须提供重复候选而不是自动合并
    - 系统 MUST 以候选形式呈现重复内容判断（识别出可能重复的对象时 SHALL 返回 duplicate candidates），而不是直接自动合并对象。

  @req:r130 @human
  场景: 维护建议必须显式触发后续动作
    - 系统 MUST 将维护建议与后续动作解耦，并向用户明确每条建议对应的可选动作，避免治理信号直接隐式改写来源状态。

  @req:r166 @human
  场景: 治理信号必须绑定到稳定的来源对象（source-scoped）
    - 系统 MUST 将 freshness 与 duplicate 等治理信号绑定到稳定的来源对象标识，而不是绑定到一次性的导入请求或临时 UI 状态；用户在不同时间打开同一来源 SHALL 能取回一致的治理信号。

  @req:r201 @human
  场景: 系统必须提供显式动作以处理治理建议
    - 系统 MUST 提供显式动作来处理 freshness/duplicate 建议（例如 ignore、re_ingest、re_embed、review），并在触发后产生可追踪的处理结果。

  @req:r201 @human
  场景: 用户对治理建议执行显式动作
    - 用户对某个来源的建议执行 ignore 时，系统 SHALL 记录该忽略状态；用户触发 re_ingest 或 re_embed 时，系统 SHALL 以后台任务形式执行该动作或返回可追踪的执行引用。

  @req:r230 @human
  场景: 工作区必须提供可聚合查看的治理入口
    - 系统 MUST 在工作区/来源管理界面提供治理入口，聚合展示 stale sources、duplicate candidates 与维护建议，避免治理能力藏在单个来源详情里。
