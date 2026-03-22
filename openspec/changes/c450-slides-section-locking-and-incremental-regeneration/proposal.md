## Why

Slides 一旦开始认真改，就会出现一个很实际的问题：我只想重生成这几页，别动另外几页。没有分段锁定和增量重生成，Slides 很容易在“自动生成”和“手工修稿”之间来回打架。

## What Changes

- 定义 slides section locking，让用户可以锁定已确认的章节或页面片段。
- 支持 incremental regeneration，只针对未锁定区块或指定区段重生成。
- 区分结构重生成、文案重生成和视觉细化，避免每次都是全量改写。
- 让锁定状态、差异预览和重生成风险提示进入正式工作流，而不是临时技巧。

## Capabilities

### New Capabilities
- `slides-section-locking-and-incremental-regeneration`: 定义 Slides 分段锁定、增量重生成和差异预览语义。

### Modified Capabilities
- `studio-slides-workflow`: 需要支持章节锁定和局部重生成入口。
- `output-draft-lifecycle-and-regeneration-safety`: 重生成保护需要细化到 section 粒度。
- `output-diff-compare-and-version-review`: 差异对比需要支持 section 级展示。

## Impact

- Backend：会影响 slides draft 结构、局部生成入口和锁定元数据。
- Frontend：会影响 Slides Studio、章节列表、锁定标记和增量预览。
- Dependencies：这条线接在 `c445` 和 `c440` 后面，属于对现有 Slides 工作流的深挖。

```mermaid
flowchart LR
  C445[c445 block 历史]
  C440[c440 输出差异对比]
  C450[c450 Slides 分段锁定]

  C445 --> C450
  C440 --> C450
```
