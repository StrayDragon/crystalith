# 证据链（引用）

Crystalith 将引用视为一等「证据链」：QA/聊天回答和结构化 Output 可包含引用，供你查看、在上下文中验证并导出分享。

## 在上下文中查看引用

1. 打开引用列表：
   - 在 Chat 中：在助手消息下方点击 **查看引用**。
   - 在 Outputs 中：打开某个 Output，点击 **查看引用**。
2. 点击某个引用项，打开 **引用抽屉**。
3. 在抽屉中你可以：
   - **查看上下文**：查看被引用的文本块及周围一小段文本。
   - **定位来源**：在来源面板中高亮显示该来源。
   - **打开来源**：打开完整的来源详情视图。

## 带引用导出（Markdown / JSON）

导出内容包括正文、引用列表及来源元数据。

入口：
- **命令面板**（`Ctrl+K`）：导出当前会话或当前 Output。
- **头部导出按钮**：快速导出操作。
- **Chat**：每个助手消息的导出菜单。
- **Outputs**：Output 查看器内的导出菜单。

格式：
- **Markdown**：人类可读正文 + 引用列表 + 来源列表。
- **JSON**：结构化载荷（content + citations + sources），供下游工具使用。

## 常见失败状态

- **未显示引用**
  - 未选择任何来源，或结果未达到证据阈值。
- **无法加载上下文**
  - 后端已断开，或引用缺少 `chunk_id`。
- **无法定位来源**
  - 来源列表已过期，或底层来源已被删除（UI 会回退为「Unknown source」）。

## API（供集成方使用）

- 引用上下文查询：
  - `GET /v1/notebooks/{notebook_id}/citations/context?chunk_id=...`
- QA 导出：
  - `GET /v1/notebooks/{notebook_id}/qa/export?session_id=...&format=markdown|json`
- Output 导出：
  - `GET /v1/notebooks/{notebook_id}/outputs/{output_id}/export?format=markdown|json`

引用约定：引用对象使用 `chunk_index` 作为来源内的 1-based 索引。
