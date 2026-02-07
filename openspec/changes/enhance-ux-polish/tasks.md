## 1. 拖拽上传

- [x] 1.1 在 SourcesPanel 添加 drag-and-drop 区域，监听 `dragover`/`drop` 事件
- [x] 1.2 拖拽时显示视觉反馈（高亮边框 + "拖放文件到此处"提示）
- [x] 1.3 支持拖拽多个文件，使用现有上传流程逐个处理
- [x] 1.4 编写测试：模拟 drop 事件，验证文件被正确传递给上传逻辑
- [x] 1.5 验证：拖拽 3 个 .md 文件到 SourcesPanel，全部成功上传

## 2. AI 操作取消

- [x] 2.1 后端：QA stream 端点支持 AbortController/客户端断连检测，断连时停止 LLM 生成
- [x] 2.2 后端：Output 生成任务添加 `CANCELLED` 状态和取消 API（`POST /tasks/{id}/cancel`）
- [x] 2.3 前端：ChatPanel 发送消息时显示"停止生成"按钮，点击后 abort fetch
- [x] 2.4 前端：StudioPanel 输出生成队列项添加取消按钮
- [x] 2.5 编写测试：发起 QA 后立即取消，验证不返回完整响应且前端状态正确
- [x] 2.6 验证：流式 QA 过程中点击停止，流中断且已接收部分正常显示

## 3. 进度指示改进

- [x] 3.1 批量搜索结果添加进度：显示"正在添加 3/10 个来源"
- [x] 3.2 Research session 进度：显示当前迭代/总迭代数
- [ ] 3.3 Source 嵌入进度：在 source 状态中显示"索引中 (45%)"（需后端 SSE 支持，暂缓）
- [ ] 3.4 验证：各场景的进度指示准确反映实际处理进度（依赖 3.3，暂缓）

## 4. 焦点陷阱与无障碍

- [x] 4.1 在 `shared/` 创建 `useFocusTrap` hook，基于 Tab/Shift+Tab 循环
- [x] 4.2 为 SourceDetailDialog 添加焦点陷阱
- [x] 4.3 为 SlidesStudioDialog 添加焦点陷阱
- [x] 4.4 为 ResearchDetailPanel 添加焦点陷阱
- [x] 4.5 为 AddSearchResultDialog 添加焦点陷阱
- [x] 4.6 验证：Tab 键在 Modal 内循环，不逃逸到背景内容

## 5. 过渡动画

- [x] 5.1 面板数据加载完成时添加 fade-in 过渡（150ms opacity transition）
- [x] 5.2 列表项新增时添加 slide-in 动画
- [x] 5.3 Modal 打开/关闭添加 scale + fade 动画
- [x] 5.4 遵守 `prefers-reduced-motion` 偏好，减弱或禁用动画
- [x] 5.5 验证：动画流畅且不影响交互响应速度

## 6. 空状态引导

- [x] 6.1 新 notebook 无 source 时显示引导卡片："添加文档开始分析"
- [x] 6.2 有 source 但无会话时显示提示："选择来源后提问"
- [x] 6.3 Studio 无输出时显示引导："选择来源 → 点击工具卡片生成"
- [x] 6.4 验证：新用户按引导完成首次完整流程（上传 → 选择 → 提问 → 生成输出）

## 7. Toast 统一

- [x] 7.1 审计所有 Toast 调用，统一成功/失败/警告的样式和显示时长
- [x] 7.2 成功 Toast：绿色，3s 自动关闭
- [x] 7.3 错误 Toast：红色，5s 自动关闭，可手动关闭
- [x] 7.4 验证：所有操作的 Toast 反馈风格一致
