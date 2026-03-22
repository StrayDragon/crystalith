## Why

图表能看懂是一回事，图表能被快速转述又是另一回事。很多时候用户想要的不是再读一遍数据，而是一段能放进 briefing、report 或卡片里的视觉摘要。

## What Changes

- 定义 chart captioning，为图表生成可读的标题、注释和重点解释。
- 支持 visual summary card，把图表结论收成可插入其他输出的小卡片。
- 区分自动生成的说明和用户修过的说明，避免后续刷新把人写的东西冲掉。
- 让图表摘要既能服务可访问性，也能服务内容编排。

## Capabilities

### New Capabilities
- `chart-captioning-and-visual-summary-cards`: 定义图表标题说明、视觉摘要卡和可复用边界。

### Modified Capabilities
- `charts-dashboards-and-data-storytelling`: 需要支持图表说明与摘要卡。
- `audio-video-briefings`: 多模态输出可以消费视觉摘要。
- `briefing-assembly-board-and-evidence-pinning`: 需要能插入视觉摘要卡。

## Impact

- Backend：会影响图表摘要生成和卡片载荷。
- Frontend：会影响图表查看器、摘要卡渲染和插入入口。
- Dependencies：这条线是 `c470` 的旁路增强，补的是“图看完以后怎么用”。
