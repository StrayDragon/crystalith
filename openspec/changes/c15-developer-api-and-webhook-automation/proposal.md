## Why

只在 Workspace 里手动点按钮，迟早会碰到边界。团队会想把结果同步到别的系统，把外部事件回流到 Crystalith，或者直接把一些能力接进自己的产品流程里。

## What Changes

- 提供面向外部系统的开发者 API，覆盖 notebook、sources、runs、knowledge pack、share 结果等核心对象。
- 引入 webhook 订阅能力，让来源同步完成、研究完成、审批完成、发布完成等事件可以主动推给外部系统。
- 支持 API token、scope、回调签名、重试策略和事件版本管理。
- 让“外部触发一次流程”和“外部消费一个结果”成为正式产品能力，而不是私有脚本绕接。

## Capabilities

### New Capabilities
- `developer-api-and-webhooks`: 定义外部开发者接口、事件订阅、回调投递和安全边界。

### Modified Capabilities
- `workspace-api-contract`: 需要扩展为可对外开放的稳定接口面，并增加 token scope、事件回调和版本语义。
- `publishable-artifacts`: 需要支持对外拉取、增量同步和结果发布事件的正式契约。
- `openapi-and-client-generation`: 需要明确公共 API 的 OpenAPI 边界、生成策略和客户端分发要求。
- `source-connectors`: 需要支持外部触发同步、监听同步事件和读取连接器运行状态的正式行为。

## Impact

- Backend：公共 API、token 管理、webhook 递送、签名校验和事件重试队列。
- Frontend：开发者设置页、token 管理、webhook 配置与测试入口。
- Ecosystem：这会把 Crystalith 从“一个工作台”扩展成“能接进其他系统的能力节点”。
- Dependencies：建议放在 `c06-publish-and-share-knowledge-packs`、`c09-external-share-portals`、`c11-connectors-sync-marketplace` 之后统一讨论。
