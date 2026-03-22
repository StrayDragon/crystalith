## Why

前两阶段把首次成功、可信审阅、协作分享和组织治理的骨架搭起来了，但真正到了团队落地时，大家还是会重复做同样的搭建动作：建 notebook、配来源、选 recipe、定审阅节奏。没有模板和 playbook，Crystalith 还是更像高手工具，而不是可以复制到更多团队里的工作方式。

## What Changes

- 引入 workspace template 和 operating playbook，让团队可以把一套成熟的研究流程、角色分工、默认输出和审阅节奏打包成可复用模板。
- 支持从模板创建 notebook、批量初始化来源结构、默认命令集、推荐结果类型和协作入口，而不是每次从空白开始搭。
- 允许团队维护 playbook 版本，区分“草稿模板”“推荐模板”“组织默认模板”。
- 让 onboarding、recipes、审批、分享和周期性监测都能挂接到 playbook，而不是各自孤立配置。

## Capabilities

### New Capabilities
- `workspace-templates-and-playbooks`: 定义工作区模板、流程手册、默认动作集和组织级复用能力。

### Modified Capabilities
- `workspace-ui-core`: 需要增加从模板创建工作区、查看模板来源和切换 playbook 的稳定入口。
- `workspace-command-registry`: 需要支持模板注入的默认动作与按 playbook 暴露的上下文命令。
- `chat-prompt-presets`: 需要支持模板级 prompt preset 继承与组织推荐配置。
- `multi-notebook-collections`: 需要支持模板作用于单 notebook 或 notebook 集合，而不是只覆盖单点页面。
- `workspace-api-contract`: 需要增加模板目录、模板实例化和 playbook 版本查询的正式接口语义。

## Impact

- Backend：模板定义存储、实例化逻辑、组织默认项和版本关系。
- Frontend：模板选择器、playbook 说明页、基于模板的创建流和模板来源提示。
- Product：这会把 Crystalith 从“每次重搭的工作台”往“可以复制的团队方法”再推一步。
- Dependencies：建议接在 `c02-recipe-driven-workflows`、`c07-identity-and-workspace-access`、`c08-multiplayer-review-workspace`、`c13-recurring-monitoring-and-delta-briefings` 之后。
