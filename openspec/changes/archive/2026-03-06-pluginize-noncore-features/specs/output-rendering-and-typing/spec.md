# output-rendering-and-typing Specification (Delta)

## MODIFIED Requirements

### Requirement: Output payload is modeled as discriminated union
前端 MUST 以 `output.type` 作为判别字段建模 payload，保证类型 narrowing 可用；当输出类型来自插件且客户端未知时，类型系统 MUST 提供一个 “unknown/other” 分支以避免编译期与运行期崩溃。

#### Scenario: Type narrowing supports unknown plugin output types
- **WHEN** 前端收到一个带有未知 `output.type` 的输出 payload（未在客户端枚举/联合类型中声明）
- **THEN** 系统 SHALL 将其归入 unknown 分支并进入安全降级渲染路径
- **AND** 不得因类型缺失导致渲染链路崩溃
