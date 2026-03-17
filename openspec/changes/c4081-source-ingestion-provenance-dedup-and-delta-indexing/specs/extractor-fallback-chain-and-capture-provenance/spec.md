# extractor-fallback-chain-and-capture-provenance 规范增量

## ADDED Requirements

### Requirement: Extraction MUST Record Fallback Decisions and Capture Provenance
系统 MUST 记录 extractor fallback chain 与 capture provenance，而不是让提取选择只存在于内部日志。

#### Scenario: 主 extractor 失败后切换到备用 extractor
- **WHEN** 系统对某个 source 尝试多个 extractor
- **THEN** 系统 SHALL 记录尝试顺序、失败分类与最终选中的 extractor
- **AND** SHALL 保留 capture provenance 供后续诊断或展示

### Requirement: Provenance MUST Explain Quality Loss and Partial Capture
系统 MUST 能区分抓不到、抓不全与抓到了但质量折损，而不是统一显示为“导入成功”或“失败”。

#### Scenario: 某个 extractor 只能拿到部分正文
- **WHEN** source 只被部分提取或内容质量明显折损
- **THEN** 系统 SHALL 将这种折损记录为 provenance 的一部分
- **AND** SHALL 让上层状态与诊断面能解释这类不完整性
