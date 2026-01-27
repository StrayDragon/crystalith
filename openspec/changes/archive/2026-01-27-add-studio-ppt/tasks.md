## 1. 需求与数据建模
- [x] 1.1 明确 SLIDES 产出结构与状态字段（stage/status/engine/引用范围）
- [x] 1.2 设计演示草稿数据模型（outline、markdown、时间戳）
- [x] 1.3 定义 SSE 事件模型（start/progress/toolcall/done/error/busy）

## 2. 后端能力
- [x] 2.1 增加 OutputType.SLIDES 元信息并注册到 Studio 工具列表
- [x] 2.2 实现大纲生成流程（支持引用选择/检索上下文）
- [x] 2.3 实现 Markdown 生成流程（基于大纲 + 上下文）
- [x] 2.4 提供大纲/Markdown 保存与读取 API
- [x] 2.5 移除 Slidev CLI 预览接口，改为保存 Markdown 时同步更新预览文件
- [x] 2.6 迁移 `backend/py/src/crystalith/slides` 逻辑到 `backend/py/src/crystalith/studio/slides`
- [ ] 2.7 增加并发/忙碌锁与失败恢复策略

## 3. 前端工作区 UI/UX
- [x] 3.1 Studio 工具网格新增“演示”入口与图标
- [x] 3.2 三阶段界面：输入 → 大纲 → Markdown（含状态恢复）
- [x] 3.3 SSE 进度与错误态展示（支持重试）
- [x] 3.4 大纲编辑器与 Markdown 编辑器（保存/再生成）
- [x] 3.5 预览区域改为 iframe（Slidev 预览服务）与新窗口打开
- [x] 3.6 Markdown 阶段优化预览/编辑分栏比例

## 4. Slidev 预览服务
- [x] 4.1 新增 `frontend/packages/crystalith-slidev` 包（Slidev CLI 预览服务）
- [x] 4.2 预览服务启动前确保 `data/output/preview/slides.md` 存在
- [x] 4.3 更新 Procfile/启动说明，确保 overmind 同时拉起预览服务

## 5. 接口与联调
- [x] 5.1 更新 OpenAPI 与前端 SDK（`pnpm run api:generate`）
- [x] 5.2 移除前端对预览接口的残留引用
- [x] 5.3 文档说明 Slidev CLI 依赖与运行方式（前端侧）

## 6. 测试与验证
- [ ] 6.1 后端：演示流程与 SSE 端点测试
- [ ] 6.2 前端：三阶段 UI 与编辑保存测试
- [ ] 6.3 手动验收：生成/编辑/预览全流程（overmind）
