# Design — B 组收口

## 逐条处置与证据

| req  | 现状证据                                                                                                                                                                                      | 处置                           |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| r101 | `useResearchTasks`：SWR listRuns（打开即拉、revalidateOnFocus）+ controller 各事件后 `refreshResearchTasks`；缺「非终态时短间隔轮询」                                                         | **照做**：条件 refreshInterval |
| r416 | UploadSection 仅列表项级 error 图标；面板头部无失败汇总                                                                                                                                       | **照做**：头部摘要条           |
| r405 | `tool_use`/`autoExecute`/`toolResult` 在 messages 域零命中；v2 chat content 为纯文本（r350），agent 工具（retrieveSources 等）在 loop 内部不产生消息 parts；Rivu dropped 决策放弃消息内嵌组件 | **移除**（架构冲突）           |
| r411 | SourcesPanelView 无 tab 概念；单列表 + `useSourcesPanelSelection` checkbox 已承载选择语义；三 tab/history/独立滚动为完整 UX 蓝图                                                              | **移除**（无排期 UX 蓝图）     |
| r413 | useChat 用本地 `streamingMessageId` 等本地标记；server messages 表无 status 字段；无重连语义                                                                                                  | **移除**（双层 spec-ahead）    |
| r417 | 唯一 onDrop 在上传区（触发上传）；「仅入列不上传」需纯客户端假条目，与来源=服务端实体架构不符                                                                                                 | **移除**（架构不符）           |

## 实现设计

### r101 条件轮询

```ts
// researchTaskTypes.ts（或 cache 旁）导出纯函数：
export function researchQueuePollInterval(activeCount: number): number {
  return activeCount > 0 ? 5_000 : 0;
}
```

`useResearchTasks` 内 `refreshInterval: researchQueuePollInterval(activeCount)`（SWR 条件轮询；activeCount=0 → 0 即关闭）。规则各子句对应：打开拉取=SWR key 挂载即请求；操作后立即再拉=controller 事件刷新（已有）；不引入 list SSE=纯客户端轮询（天然满足）。锁测：纯函数三态（0/active/负值容错）+ hook 集成（rerender 换 data 观察 interval 变化——以纯函数为主，hook 走既有 researchTasksCache.test 范式补一条 active→interval>0 断言）。

### r416 面板错误快照

`SourcesPanelView` 在工具栏下渲染摘要条（仅当有失败时出现）：

```ts
const failedSources = sources.filter((s) => s.status === 'failed');
const failedUploads = (uploadQueue ?? []).filter((u) => u.status === 'error');
const firstMessage = failedUploads[0]?.message ?? failedSources[0]?.errorMessage ?? '';
```

显示：`N 个来源失败：{firstMessage}`（data-testid 锚定）。锁测：扩展 `SourcesPanel.test.tsx`——有失败时出现摘要且计数正确、无失败时不渲染。

## 移除的连带检查

四条均无代码/测试/文档引用（grep 证实 messages 域无 tool 卡、无 tab 状态机、无消息 status 派生层、无非上传区 drop 目标），移除无连带清理。

## 测试边界

web 侧复用既有范式（`@rstest/core` 命名导入 + TestProviders/testing-library），不新增 harness；server 零改动。
