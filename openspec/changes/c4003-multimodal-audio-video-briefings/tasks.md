## 0. Phase 0：契约与入口（占位）

### 0.1 Audio

- [ ] 0.1.1 创建 `api/audio.py` 模块
- [ ] 0.1.2 定义 `POST /outputs/audio` 端点
- [ ] 0.1.3 定义请求/响应 Schema
- [ ] 0.1.4 端点返回 501 Not Implemented（含功能状态说明）

### 0.2 Video

- [ ] 0.2.1 创建 `api/video.py` 模块
- [ ] 0.2.2 定义 `POST /outputs/video` 端点
- [ ] 0.2.3 定义请求/响应 Schema
- [ ] 0.2.4 端点返回 501 Not Implemented（含功能状态说明）

## 1. OpenAPI 文档

- [ ] 1.1 确保两个端点出现在 OpenAPI Schema
- [ ] 1.2 添加详细的 API 文档说明
- [ ] 1.3 标注功能状态为“计划中”

## 2. 前端 UI（占位）

- [ ] 2.1 添加音频简报入口到 Studio 面板
- [ ] 2.2 添加视频简报入口到 Studio 面板
- [ ] 2.3 两个入口均显示“即将推出”标签且处于禁用状态
- [ ] 2.4 点击时显示功能说明对话框

## 3. 测试与验证

- [ ] 3.1 API 契约测试（验证 `/outputs/audio` 与 `/outputs/video` 均返回 501）
- [ ] 3.2 前端组件测试（Audio/Video 入口）
