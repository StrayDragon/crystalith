# language: zh-CN
功能: 上下文窗口
  作为 AI 对话核心组件
  我希望能管理上下文窗口
  以便在 token 预算内组装最优的提示

  场景: 预算内构建上下文
    假如 一个最大200 token的上下文窗口
    当 构建上下文：系统消息为"你是一个助手"，历史为空，查询为"你好"
    那么 上下文未压缩
    而且 总 token 数不超过200

  场景: 超出预算时压缩
    假如 一个最大10 token的上下文窗口
    当 构建上下文：系统消息为"hi"，历史为空，查询为"what is quantum computing and how does it work in modern practice"
    那么 上下文已压缩
    而且 总 token 数不超过10

  场景: 按优先级截断
    假如 一个最大20 token的上下文窗口
    当 构建上下文：系统消息为"system prompt"，历史为3条长消息，查询为"question"，检索为很长的检索内容
    那么 总 token 数不超过20

  场景: 窗口滑动
    假如 一个窗口大小为2、最大500 token的上下文窗口
    当 构建上下文：系统消息为"system"，历史为5条消息，查询为"question"
    那么 消息列表中包含最近2条历史消息
    而且 消息列表第一条为系统消息

  场景: 统计信息跟踪
    假如 一个最大500 token的上下文窗口
    当 构建上下文：系统消息为"system prompt"，历史为2条消息，查询为"question"，检索为"retrieval content"
    那么 上下文统计包含系统token
    而且 上下文统计包含历史token
    而且 上下文统计包含查询token
    而且 上下文统计包含检索token
