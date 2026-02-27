## ADDED Requirements

### Requirement: Cache keys never contain secrets
任何由配置派生的 cache key（例如 API key）MUST 使用不可逆指纹而非明文 secret，并且 MUST 可安全打印到日志/指标中。

#### Scenario: OpenAI client cache key uses fingerprint
- **WHEN** 系统按 OpenAI API key 缓存 client
- **THEN** cache key SHALL 仅包含该 key 的一向性指纹而不包含原始 API key
