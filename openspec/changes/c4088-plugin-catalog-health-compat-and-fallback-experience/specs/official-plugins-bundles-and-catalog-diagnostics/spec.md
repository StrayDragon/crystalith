# official-plugins-bundles-and-catalog-diagnostics 规范增量

## ADDED Requirements

### Requirement: Official Plugin Availability MUST Be Computed from a Stable Catalog
系统 MUST 基于稳定的 official plugin catalog 计算能力可用性，而不是临时 import 插件后再猜测状态。

#### Scenario: 用户查看当前有哪些官方插件能力
- **WHEN** 系统展示 tools、diagnostics 或 capability matrix
- **THEN** SHALL 使用统一 catalog 计算 loaded、skipped 或 not_installed 状态
- **AND** SHALL 提供对应 install/enable hints

### Requirement: Packaging Tiers MUST Explain Capability Differences
系统 MUST 让 core-only 与 official-full 等安装档位对能力差异保持可解释，而不是只靠文档备注。

#### Scenario: 用户从 core-only 升级到更完整插件集
- **WHEN** 用户比较不同安装档位
- **THEN** 系统 SHALL 能指出各档位预期覆盖的能力
- **AND** SHALL 明确缺失能力对应的典型症状
