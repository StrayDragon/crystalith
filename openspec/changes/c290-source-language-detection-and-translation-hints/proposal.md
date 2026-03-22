## Why

来源一旦跨语言，问题不只是看不懂，还会影响引用、搜索和后续生成。现在如果系统不先把语言信号立起来，跨语言材料会一直像“能导入，但不好用”。

## What Changes

- 定义 source language detection，为来源和片段补稳定语言标记。
- 增加 translation hint，说明哪些来源可能需要翻译或双语处理。
- 区分自动翻译建议和正式翻译产物，避免把提示和转换混为一谈。
- 让语言信息回流到搜索、引用和多模态输出，而不是只停在来源详情。

## Capabilities

### New Capabilities
- `source-language-detection-and-translation-hints`: 定义来源语言识别、翻译提示和跨语言处理边界。

### Modified Capabilities
- `source-ingestion-core`: 需要在接入阶段补语言标记。
- `unified-search-query-and-rerank`: 搜索需要消费语言信号。
- `audio-video-briefings`: 多模态输出需要知道来源语言和处理建议。

## Impact

- Backend：会影响语言检测、来源元数据和搜索过滤。
- Frontend：会影响来源详情、搜索过滤和翻译提示。
- Dependencies：这条线承接 `c285`，也能为跨语言检索和输出打底。
