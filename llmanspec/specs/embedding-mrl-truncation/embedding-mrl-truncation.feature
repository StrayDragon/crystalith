# language: zh-CN
# capability: embedding-mrl-truncation
# purpose: 定义 MRL（套娃）截断的可选启用行为：配置开关与合法域、截断必再归一化、网关参数优先与客户端兜底双路径、eval 基准先行的启用门槛。声明与透出在 embedding-runtime（r474），重建与维度守卫沿用 embedding-index-ops / r478 语义。

功能: embedding-mrl-truncation

  @req:r493
  规则: 截断是可选配置，默认关闭
    embedding 截断 MUST 以配置开关承载（语义为目标维度；缺省/空 = 不截断）。合法目标维度 MUST 属于所选模型 embedding 声明 mrlDims 的成员（消费 embedding-runtime r474 的声明 SSOT）；非法值 MUST 在配置加载时拒绝并给出可读错误。开关关闭时 embedding 行为 MUST 与启用前完全一致（零变化）。

    场景: config-rejects-dims-outside-mrl-declaration
      假如 app.yaml 为 embeddinggemma2-gateway（声明 mrlDims [768,512,256,128]）配置目标维度 300
      当 装载声明 mrlDims 的模型配置并设定截断目标维度（非成员值/成员值/缺省各一）
      那么 配置加载失败并提示合法域为 mrlDims 成员
      而且 配置 256（成员）与缺省（关闭）均被接受

  @req:r494
  规则: 截断 MUST 强制再归一化，双路径单语义
    启用截断时，入库向量维度 MUST 等于目标维度且模长 MUST ≈ 1（L2 归一化，容差 1e-3）。实现 MUST 网关参数优先（embed 请求携带 dimensions 目标维度，网关侧截断归一），网关不支持时 MUST 降级客户端路径（收全维向量后切片前 N 维并内联 L2 再归一化）；降级结论 MUST 留下可观测日志。网关返回向量模长越界时 MUST warn 但不阻断。

    场景: truncated-vectors-are-normalized-and-dimension-exact
      假如 注入假 embed 模型并启用目标维度 256
      当 启用截断发起嵌入且网关对 dimensions 参数呈 认参数/忽略/拒绝 三态
      那么 客户端路径切片后向量模长 ≈ 1 且维度 = 256
      而且 网关路径携带 dimensions 参数；网关违约（模长越界）产生 warn 且向量照常入库

  @req:r495
  规则: 启用决策 MUST 由 eval 基准数据先行
    MRL 截断的启用/默认推荐 MUST 以固定语料 eval 基准（recall@k / nDCG@10，768 维基线对比 512/256）为依据；基准 runner 与语料 fixture MUST 随仓库维护（可复现、不依赖真实用户库），报告 MUST 落盘留档。256 维 recall@10 相对基线衰减超过 5% 时 MUST 判 no-go 并保持默认关闭。

    场景: eval-baseline-runs-and-reports-recall
      假如 仓库内存在 mrl-eval 语料 fixture 与已知查询对
      当 对固定语料评估 768/512/256 三档截断的检索质量
      那么 输出 768/512/256 三组 recall@10 与 nDCG@10 并落盘报告
      而且 衰减超阈值的结论使 runner 以非 0 退出（no-go 可判定）
