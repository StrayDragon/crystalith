# cross-type-result-transformations 规范增量

## ADDED Requirements

### Requirement: 系统必须显式声明受支持的跨类型转换路径
系统 MUST 以显式能力清单声明受支持的跨类型转换路径，而不是暗示任意类型都可互转。

#### Scenario: 用户查看某个结果可执行的转换动作
- **WHEN** 用户查看一个已有结果
- **THEN** 系统 SHALL 只展示该结果受支持的转换路径
- **AND** SHALL 不展示未被定义为稳定路径的互转动作

### Requirement: 跨类型转换必须保留 lineage 与映射边界
系统 MUST 记录跨类型转换的 lineage，并明确保留与丢弃边界。

#### Scenario: 用户将一种结果转换为另一种类型
- **WHEN** 用户执行一次受支持的跨类型转换
- **THEN** 系统 SHALL 记录来源结果与目标结果之间的 lineage
- **AND** SHALL 明确哪些内容被保留、哪些内容被舍弃或重建

### Requirement: 不受支持的路径必须回退为重新生成
系统 MUST 在不支持直接转换的情况下回退为重新生成，而不是提供不可靠的伪转换。

#### Scenario: 用户尝试执行未定义的转换路径
- **WHEN** 用户请求一个未被支持的跨类型转换
- **THEN** 系统 SHALL 明确提示该路径不受支持
- **AND** SHALL 提供回到重新生成流程的路径

### Requirement: 系统必须提供显式的转换动作并返回新结果
系统 MUST 提供显式的跨类型转换动作，并在成功时返回一个新的结果对象与可追溯的转换记录。

#### Scenario: 用户执行一次受支持的转换
- **WHEN** 用户从某个结果发起一次受支持的跨类型转换
- **THEN** 系统 SHALL 生成目标类型的新结果对象
- **AND** 系统 SHALL 返回该新结果与对应的 transformation record（包含 route_id 与 from/to 关联）

### Requirement: 转换请求与结果元数据必须显式表达目标类型与映射摘要
系统 MUST 在转换请求与结果元数据中显式表达目标类型，并提供可理解的映射摘要（保留/重建边界）用于 UI 展示。

#### Scenario: UI 展示转换预期
- **WHEN** 用户在执行转换前查看该转换的影响
- **THEN** 系统 SHALL 能提供该 route 的保留/重建摘要
- **AND** UI SHALL 能据此提示用户哪些内容会被继承或重建
