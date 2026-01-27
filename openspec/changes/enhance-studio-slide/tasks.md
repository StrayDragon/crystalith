## 1. 数据模型与 API

- [ ] 1.1 定义 SlideGenerationConfig 数据结构（数量/受众/结构/语气/语言/密度/主题预设/frontmatter/自定义约束）
- [ ] 1.2 StudioSlide 增加 generation_config JSON 字段并处理默认值
- [ ] 1.3 slides draft create/update/read 接口支持 generation_config
- [ ] 1.4 更新 OpenAPI schema 并同步前端 SDK（`pnpm run api:generate`）

## 2. LLM 生成策略

- [ ] 2.1 在大纲与 Markdown prompt 中注入 generation_config 约束（数量范围、结构模板、语气风格、受众、语言、主题预设）
- [ ] 2.2 生成 Markdown 时自动生成/补全 frontmatter（内置主题、布局、字体等字段）
- [ ] 2.3 支持从生成入口传入 model_id（与其他工具一致）
- [ ] 2.4 为配置映射与 prompt 拼接添加单元测试

## 3. Studio 入口与配置 UI

- [ ] 3.1 “演示”卡片点击后自动创建草稿并串联 outline -> markdown SSE 生成
- [ ] 3.2 提供演示配置入口（卡片配置按钮打开输入阶段设置区），支持保存/回填
- [ ] 3.3 提供主题预设选择与 frontmatter 预览/编辑入口（支持自动生成与手动覆盖）
- [ ] 3.4 生成过程中展示进度、错误与重试入口

## 4. 输出与历史同步

- [ ] 4.1 Markdown 完成后刷新输出列表并关联草稿 ID
- [ ] 4.2 失败状态不影响已完成的输出记录

## 5. 测试与验证

- [ ] 5.1 后端：slides config 读写与默认值测试
- [ ] 5.2 后端：prompt 组装、主题预设/frontmatter 生成与模型选择测试
- [ ] 5.3 前端：演示卡片一键生成、配置保存、主题预设选择与 frontmatter 覆盖测试
- [ ] 5.4 手动验证：选择引用 -> 一键生成 -> 编辑大纲 -> 生成 Markdown -> 主题/frontmatter 生效 -> 预览
