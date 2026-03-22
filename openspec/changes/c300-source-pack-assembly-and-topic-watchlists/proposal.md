## Why

很多来源不是单篇值得看，而是一组放在一起才有意义。现在工作区已经能装很多来源，但还缺一层把同主题、同问题域的来源装成“来源包”的能力。

## What Changes

- 定义 source pack，把同主题、同问题或同任务相关的来源装成稳定集合。
- 支持 topic watchlist，让来源包对某个主题保持持续关注。
- 让来源包既能服务检索，也能服务 research run 和 briefing 组装。
- 区分静态整理包和持续观察包，避免一个模型管两种完全不同用法。

## Capabilities

### New Capabilities
- `source-pack-assembly-and-topic-watchlists`: 定义来源包、主题观察列表和集合级操作语义。

### Modified Capabilities
- `source-coverage-and-evidence-map`: 覆盖图需要支持来源包视角。
- `recurring-monitoring-and-delta-briefings`: 主题观察需要能挂到持续监测。
- `workspace-api-contract`: 需要增加来源包与 watchlist 接口。

## Impact

- Backend：会影响来源集合对象、观察规则和集合级摘要。
- Frontend：会影响来源包视图、观察列表和引用入口。
- Dependencies：这条线把来源从“单条管理”再往“按主题管理”推进一步。
