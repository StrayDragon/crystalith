# language: zh-CN
功能: 深度研究
  作为一个用户
  我希望能够创建和管理深度研究会话
  以便对主题进行深入的多轮搜索和分析

  背景:
    假如 已启动应用
    并且 一个名为"研究测试笔记本"的笔记本

  场景: 创建深度研究会话
    当 发送 POST 请求"/v2/notebooks/{当前笔记本[id]}/research"，内容为：
      """json
      {"topic": "人工智能发展趋势", "max_iterations": 3}
      """
    那么 响应状态码为201
    并且 响应中"topic"的值为"人工智能发展趋势"
    并且 响应中"status"的值为"planning"
    并且 响应中"current_iteration"的值为1
    并且 响应中"max_iterations"的值为3

  场景: 列出笔记本的研究会话
    假如 笔记本中有一个研究会话"测试主题"
    当 发送 GET 请求"/v2/notebooks/{当前笔记本[id]}/research"
    那么 响应状态码为200
    并且 响应列表至少包含1条记录

  场景: 获取研究会话详情
    假如 笔记本中有一个研究会话"详情测试"
    当 发送 GET 请求"/v2/notebooks/{当前笔记本[id]}/research/{研究会话[id]}"
    那么 响应状态码为200
    并且 响应中"topic"的值为"详情测试"
    并且 响应中"status"的值为"planning"

  场景: 删除研究会话
    假如 笔记本中有一个研究会话"待删除主题"
    当 发送 DELETE 请求"/v2/notebooks/{当前笔记本[id]}/research/{研究会话[id]}"
    那么 响应状态码为204

  场景: 研究会话不存在时返回404
    当 发送 GET 请求"/v2/notebooks/{当前笔记本[id]}/research/99999"
    那么 响应状态码为404

  场景: 启动研究执行
    假如 笔记本中有一个研究会话"启动测试"
    当 发送 POST 请求"/v2/notebooks/{当前笔记本[id]}/research/{研究会话[id]}/start"，内容为：
      """json
      {}
      """
    那么 响应状态码为200

  场景: 非规划状态无法启动研究
    假如 笔记本中有一个已取消的研究会话"已取消主题"
    当 发送 POST 请求"/v2/notebooks/{当前笔记本[id]}/research/{研究会话[id]}/start"，内容为：
      """json
      {}
      """
    那么 响应状态码为400

  场景: 取消研究会话
    假如 笔记本中有一个研究会话"取消测试"
    当 发送 POST 请求"/v2/notebooks/{当前笔记本[id]}/research/{研究会话[id]}/cancel"，内容为：
      """json
      {}
      """
    那么 响应状态码为200
    并且 响应中"status"的值为"cancelled"

  场景: 已完成的研究无法取消
    假如 笔记本中有一个已完成的研究会话"已完成主题"
    当 发送 POST 请求"/v2/notebooks/{当前笔记本[id]}/research/{研究会话[id]}/cancel"，内容为：
      """json
      {}
      """
    那么 响应状态码为400

  场景: 恢复已取消的研究会话
    假如 笔记本中有一个已取消的研究会话"恢复测试"
    当 发送 POST 请求"/v2/notebooks/{当前笔记本[id]}/research/{研究会话[id]}/resume"，内容为：
      """json
      {}
      """
    那么 响应状态码为200

  场景: 已完成的研究无法恢复
    假如 笔记本中有一个已完成的研究会话"不可恢复主题"
    当 发送 POST 请求"/v2/notebooks/{当前笔记本[id]}/research/{研究会话[id]}/resume"，内容为：
      """json
      {}
      """
    那么 响应状态码为400

  场景: 提前结束研究
    假如 笔记本中有一个研究会话"提前结束测试"
    当 发送 POST 请求"/v2/notebooks/{当前笔记本[id]}/research/{研究会话[id]}/finish"，内容为：
      """json
      {}
      """
    那么 响应状态码为200
    并且 响应中"status"的值为"completed"

  场景: 已完成的研究无法再次结束
    假如 笔记本中有一个已完成的研究会话"重复结束主题"
    当 发送 POST 请求"/v2/notebooks/{当前笔记本[id]}/research/{研究会话[id]}/finish"，内容为：
      """json
      {}
      """
    那么 响应状态码为400

  场景: 导出研究报告为来源
    假如 笔记本中有一个已完成且有报告的研究会话"导出测试"
    当 发送 POST 请求"/v2/notebooks/{当前笔记本[id]}/research/{研究会话[id]}/export"，内容为：
      """json
      {"export_type": "source", "include_report": true}
      """
    那么 响应状态码为200
    并且 响应中"success"为真

  场景: 导出研究报告为笔记
    假如 笔记本中有一个已完成且有报告的研究会话"笔记导出测试"
    当 发送 POST 请求"/v2/notebooks/{当前笔记本[id]}/research/{研究会话[id]}/export"，内容为：
      """json
      {"export_type": "note", "include_report": true}
      """
    那么 响应状态码为200
    并且 响应中"success"为真

  场景: 无效导出类型返回400
    假如 笔记本中有一个已完成且有报告的研究会话"无效导出测试"
    当 发送 POST 请求"/v2/notebooks/{当前笔记本[id]}/research/{研究会话[id]}/export"，内容为：
      """json
      {"export_type": "invalid_type"}
      """
    那么 响应状态码为400

  场景: 按状态筛选研究会话
    假如 笔记本中有一个研究会话"筛选测试一"
    并且 笔记本中有一个已完成的研究会话"筛选测试二"
    当 发送 GET 请求"/v2/notebooks/{当前笔记本[id]}/research?status=completed"
    那么 响应状态码为200
    并且 响应列表包含1条记录

  场景: SSE 流式获取研究进度
    假如 笔记本中有一个研究会话"流式测试"
    当 请求研究会话的SSE流
    那么 SSE流包含初始状态事件
