# language: zh-CN
# capability: embedding-index-ops
# purpose: 定义 embedding 索引的运维面：异步重建任务（笔记本级与全局两模式、防重入、重启恢复）、索引状态查询、重建期间调用方降级分类，以及全部向量写路径的 chunk 元数据落库。目录默认模型翻转与网关接入为配置数据，不在本能力内。
# scope: apps/server/src/features/sources/, apps/server/src/rag/, apps/web/src/features/workspace/domains/sources/

功能: embedding-index-ops

  @req:r480
  规则: Index rebuild is an async, reentry-guarded job
    重建端点 MUST 异步启动：立即返回任务句柄（202），后台逐 ready source 执行"删旧向量 + 重嵌"，逐条累计诊断，完成后 MUST bump vector_epoch（全局模式逐笔记本 bump）。已有 running 任务时再次启动 MUST 返回 409。维度一致时 MUST 仅影响该笔记本的向量；维度不一致时 MUST 走全局模式：按声明维度重建 vec_chunks 表并重嵌全部笔记本的 ready sources。
    进程重启后，遗留的 running 任务 MUST 被标记为 interrupted，MUST NOT 静默当作成功或就绪。

    场景: rebuild-runs-async-and-bumps-epoch
      假如 某笔记本有 2 个 ready 来源且维度一致，已注入假 embed
      当 运行重建端点启动任务并等待其完成（apps/server/tests 的重建用例）
      那么 启动立即返回任务句柄且完成后该笔记本向量全部为新嵌入
      而且 vector_epoch 已递增且逐来源诊断记录了成功数

    场景: rebuild-reentry-rejected
      假如 该笔记本已有 running 重建任务
      当 再次调用重建端点
      那么 返回 409 且原任务不受影响

    场景: dim-mismatch-rebuild-is-global
      假如 vec_chunks 为 1024 维而默认模型声明 768 维
      当 启动重建
      那么 vec_chunks 按声明维度重建且全部笔记本的 ready 来源被重嵌

  @req:r481
  规则: Index status is queryable and honest
    索引状态端点 MUST 暴露 state（ready / rebuilding / dim_mismatch / interrupted）：活动任务时为 rebuilding（带进度计数）；无活动任务但现表维度与声明不一致时为 dim_mismatch（带两值）；最近任务为 interrupted 时为 interrupted；否则 ready。状态 MUST 反映真实向量表与任务表，MUST NOT 在重建中报告 ready。

    场景: status-tracks-rebuild-and-dim-mismatch
      假如 重建进行中或维度不一致（1024 表 vs 768 声明）
      当 查询索引状态端点
      那么 rebuilding 时携带进度计数
      而且 dim_mismatch 时携带现表与声明两值

  @req:r482
  规则: Retrieval callers degrade by classification during index unavailability
    索引不可用（rebuilding / dim_mismatch / interrupted）时：对话类调用方（QA 对话、单源问答）MUST 跳过检索并给出明确提示（no-evidence reason 透出）；以检索为硬前置的生成路径（outputs 生成、studio slides）MUST 返回明确的 409 INDEX_REBUILDING 错误；research retrieveSources 工具返回空结果集即可。MUST NOT 出现无提示的静默降级或悬挂等待。

    场景: qa-answers-with-notice-during-rebuild
      假如 该笔记本索引处于 rebuilding
      当 发起 QA 对话
      那么 回答携带索引重建提示且 noEvidenceReason 为 index_rebuilding
      而且 检索路径未被调用（无 embed 调用发生）

    场景: hard-prerequisite-generation-errors
      假如 该笔记本索引处于 rebuilding
      当 发起 outputs 生成或 studio slides 生成
      那么 返回 409 且错误码为 INDEX_REBUILDING

  @req:r483
  规则: Every vector write path persists chunk metadata
    任何插入 chunk 向量的代码路径（indexSource、sessions convert、单源问答转来源）MUST 在对应 chunk 行落库 embedding_model 与 embedding_dims；重嵌 MUST 更新而非残留旧值。

    场景: direct-write-paths-persist-metadata
      假如 分别经 sessions convert 与单源问答转来源两条直写路径产生带向量的 chunk
      当 检查这些 chunk 行
      那么 embedding_model 与 embedding_dims 均已落库且与假 embed 的返回一致
