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
