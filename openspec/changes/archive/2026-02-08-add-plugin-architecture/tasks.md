## 1. 插件接口定义
- [x] 1.1 定义 AIProviderPlugin 接口（继承现有 ChatProvider/EmbeddingProvider）
- [x] 1.2 定义 ParserPlugin 接口（继承现有 parser 基类）
- [x] 1.3 定义 OutputTypePlugin 接口（自定义输出类型的生成逻辑）
- [x] 1.4 编写接口文档和类型检查测试

## 2. 插件加载机制
- [x] 2.1 实现基于 Python entry_points 的插件发现
- [x] 2.2 创建 PluginRegistry（注册、查找、卸载插件）
- [x] 2.3 应用启动时自动扫描和加载已安装插件
- [x] 2.4 支持配置文件中 enable/disable 插件
- [x] 2.5 编写插件加载的集成测试

## 3. 工厂方法适配
- [x] 3.1 修改 AI provider 工厂支持从 PluginRegistry 获取 provider
- [x] 3.2 修改 parser 工厂支持从 PluginRegistry 获取 parser
- [x] 3.3 修改 output generator 支持从 PluginRegistry 获取自定义输出类型
- [x] 3.4 验证内置 provider/parser 不受影响

## 4. 开发者支持
- [x] 4.1 创建插件开发文档（接口说明、项目结构、注册方式）
- [x] 4.2 创建示例插件模板（可通过 cookiecutter 生成）
- [x] 4.3 编写插件接口的合规性测试工具

## 5. 验证
- [x] 5.1 创建一个示例 AI provider 插件并验证可被加载和使用
- [x] 5.2 验证禁用插件后系统正常运行
- [x] 5.3 验证已安装插件出现在 /v1/models 端点返回中
