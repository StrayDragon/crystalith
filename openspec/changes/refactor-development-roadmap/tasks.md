# Tasks for refactor-development-roadmap

> ⚠️ **警告**：此路线图优先级最低。如果当前有其他活跃的 changes，请先完成它们。

## Pre-flight Checklist

- [ ] 确认当前无其他活跃 changes 正在进行
- [ ] 确认所有业务需求 changes 已完成或延后
- [ ] 团队已审阅并同意路线图内容

---

## Phase 1: 基础设施强化（可并行）

- [ ] **T01**: 搜索引擎接入 (`add-search-engine`)
  - 接入 Tavily/SerpAPI，替换模拟数据
  - 添加搜索结果缓存

- [ ] **T02**: 向量存储优化 (`update-vector-storage`)
  - 解决 sqlite-vss 警告或迁移 Chroma
  - 添加性能基准测试

- [ ] **T03**: 前端测试覆盖 (`add-frontend-tests`)
  - hooks 覆盖率 > 80%
  - UI 组件覆盖率 > 60%

## Phase 2: 核心功能完善

- [ ] **T04**: CI/CD 流水线 (`add-ci-pipeline`) [依赖 T03]
  - GitHub Actions 配置
  - main 分支保护规则

- [ ] **T05**: 来源详情面板 (`add-source-detail-panel`)
  - 显示摘要、关键词、统计

- [ ] **T06**: 引用交互增强 (`update-citation-interaction`) [依赖 T03, T05]
  - 悬停预览、点击跳转、多选对比

- [ ] **T07**: 智能建议问题 (`add-smart-suggestions`) [依赖 T01]
  - 自动生成建议问题

- [ ] **T08**: 跨文档分析 (`add-cross-document-analysis`) [依赖 T01, T02]
  - 多来源关联检测、主题聚类

- [ ] **T09**: 输出复制/导出 (`add-output-export`)
  - 修复复制 TODO，添加 Markdown 导出

## Phase 3: 用户体验优化

- [ ] **T10**: 音频概述接口 (`add-audio-overview-api`) [依赖 T09]
  - API 预留，返回 501

- [ ] **T11**: 视频概述接口 (`add-video-overview-api`) [依赖 T09]
  - API 预留，返回 501

- [ ] **T12**: 深色模式 (`add-dark-mode`)
  - MUI ThemeProvider 集成

- [ ] **T13**: 移动端响应式 (`add-mobile-responsive`) [依赖 T12]
  - 面板堆叠、底部导航

- [ ] **T14**: 国际化支持 (`add-i18n`) [依赖 T12, T13]
  - react-i18next 集成，中英双语

---

## 完成标准

每个任务完成需满足：
1. 代码合并到 main
2. 测试通过且覆盖率达标
3. OpenSpec 规范增量已更新
4. API 变更已同步到 openapi.json
5. 无新增 lint 错误
