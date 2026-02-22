# search-engine Specification

## Purpose

定义外部搜索引擎集成能力：通过 SearXNG 执行真实 Web 搜索并返回标准化结果结构，附带可选的摘要 message，错误时快速显式失败，避免静默降级为“空结果”。

## Related specs

- `GLOSSARY.md`
- `config-management/spec.md`
- `source-ingestion-url/spec.md`
- `workspace-api/spec.md`
- `research-ui/spec.md`

## Requirements
### Requirement: Search Engine Integration

系统 MUST 提供与外部搜索引擎集成的能力，通过 SearXNG 返回真实搜索结果。当前仅支持 Web 模式（Scholar/Docs 暂未实现；前端仅展示 Web）。

最小行为：
- Web 模式下调用配置的 SearXNG 获取结果，并返回包含 `title/url/snippet` 的结果列表
- 客户端提交未识别的 mode 时 MUST 回退为 Web 以保持兼容
- 搜索引擎调用失败（网络/超时等）时 MUST 快速报错（不得静默返回空列表），前端据此显示错误提示

### Requirement: Search Provider Abstraction

系统 MUST 将搜索调用封装在 provider/service 层（当前实现为 SearXNG），以便在不改变调用方的前提下替换/扩展搜索后端。

配置中 SHOULD 支持设置 SearXNG 实例地址、超时时间与最大返回条数。

### Requirement: 搜索结果摘要消息
系统 **MUST** 在搜索响应中返回由摘要生成流程产生的 message，用于描述搜索结果与下一步建议。

摘要生成成功时 message MUST 非占位文本；摘要生成失败或不可用时 message MUST 为空字符串，且仍 MUST 返回真实的搜索结果列表。
