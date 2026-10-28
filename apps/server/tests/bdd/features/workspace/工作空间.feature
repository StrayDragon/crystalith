# language: zh-CN
功能: 工作空间工具
  作为一个用户
  我希望能够查看可用的工作空间工具
  以便了解系统提供的功能

  背景:
    假如 已启动应用

  场景: 列出工作空间工具及诊断信息
    当 发送 GET 请求"/v2/workspace/tools"
    那么 响应状态码为200
    并且 响应中包含"tools"字段
    并且 响应中包含"diagnostics"字段

  场景: 获取工具配置模式
    当 发送 GET 请求"/v2/workspace/tools/FAQ/config"
    那么 响应状态码为200
    并且 响应中包含"toolId"字段
    并且 响应中包含"toolLabel"字段

  场景: 不存在的工具返回404
    当 发送 GET 请求"/v2/workspace/tools/NONEXISTENT/config"
    那么 响应状态码为404
