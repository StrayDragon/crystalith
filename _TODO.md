准备发布(public)仓库的几个备忘录)

- [ ] 整理文档
  - [ ] 使用一个cursorful录制一个简约演示视频
  - [x] 准备logo : ./docs/assets/logo.webp
  - [ ] 发布一个操作指南的部署 github page 的文档 可能要独立仓库? 或者用一些文档生成器


- [ ] ci相关
  - 单测 思考下前后端怎么做
  - 自动发布pypi sdk等

- [ ] 整理部署方案 争取能一键部署 极致优化dockerfile 然后可以让用户可以一键本地使用 方便快速使用
  - 每个端可以有自己的dockerfile 然后可以在仓库顶层做一个 deployments/ 用于整理相关配置
