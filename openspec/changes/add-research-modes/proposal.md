## Why

当前搜索功能只支持基础的单次搜索，用户无法进行深度研究。在实际研究场景中，用户需要：

1. **多轮迭代搜索** - 根据初始结果扩展搜索方向
2. **智能关键词扩展** - Agent 自动生成相关查询
3. **人机协作** - 在关键决策点让用户参与
4. **研究过程可见** - 查看完整的研究历程和中间产物

## What Changes

### 后端

- **数据模型**: 新增 `ResearchSession` 和 `ResearchStep` 表
- **研究 Agent**: 使用 `pydantic-graph` 构建多步骤研究图
- **API 端点**: 研究会话 CRUD + 交互端点 + SSE 流式更新
- **AI 逻辑**: 搜索计划生成、关键词扩展、结果分析

### 前端

- **ResearchCapsule**: 研究胶囊组件（显示在搜索队列）
- **ResearchDetailPanel**: 研究详情面板（可展开的完整交互界面）
- **useResearch Hook**: 管理研究状态和 SSE 订阅
- **搜索模式选择器**: Fast Research / Deep Research 切换

## Impact

- **新增规范**: `research-modes`
- **受影响代码**:
  - `backend/py/src/crystalith/research/` - 新增研究模块
  - `backend/py/src/crystalith/api/research.py` - 研究 API
  - `backend/py/src/crystalith/db/models.py` - 数据模型
  - `frontend/web/src/features/workspace/components/Research*.tsx` - 研究组件
  - `frontend/web/src/features/workspace/hooks/useResearch.ts` - 研究 Hook
  - `frontend/web/src/features/workspace/components/SourcesPanel.tsx` - 模式选择器

## Design

详见 [design.md](./design.md)

## Risks & Mitigations

| 风险 | 缓解措施 |
|------|---------|
| AI 生成计划质量不稳定 | 提供默认 fallback 计划；允许用户修改 |
| 长时间研究可能中断 | 状态持久化到数据库；支持恢复 |
| SSE 连接不稳定 | 实现重连机制；提供轮询 fallback |
| 搜索 API 限流 | 控制并发数量；添加延迟 |
