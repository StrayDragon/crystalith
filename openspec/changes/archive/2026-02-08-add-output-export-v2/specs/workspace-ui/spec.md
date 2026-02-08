## ADDED Requirements

### Requirement: Output Export System
所有输出类型 SHALL 支持至少 Markdown 格式的导出。特定输出类型 SHALL 支持额外格式：Slides → PPTX，Quiz/Flashcard → JSON，Briefing → PDF。

#### Scenario: 导出为 Markdown
- **WHEN** 用户点击输出查看器的 "导出" 按钮并选择 "Markdown"
- **THEN** 浏览器下载包含输出内容的 .md 文件

#### Scenario: 导出 Slides 为 PPTX
- **WHEN** 用户在 Slides 查看器中选择 "导出为 PPTX"
- **THEN** 浏览器下载包含所有幻灯片的 .pptx 文件

#### Scenario: 导出格式限制
- **WHEN** 用户查看 Timeline 输出并点击 "导出"
- **THEN** 仅显示该输出类型支持的导出格式（Markdown）
