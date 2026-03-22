## Why

很多知识结果最终不是拿来精读，而是拿来快速听、快速看、快速转述。现在的输出已经覆盖文字、图谱、slides，但如果要让结果真的更容易传播，音频和视频迟早要进主线，而不是一直停在“以后再说”。

## What Changes

- 引入 audio briefing 和 video briefing 两类正式输出，而不只是预留占位接口。
- 支持把已完成的 briefing、guide、slides 或 knowledge pack 转成可播放的多模态结果。
- 为多模态产物补上封面、时长、章节、旁白脚本、播放链接和版本关系。
- 让外部分享、pack 打包和结果复用能把音视频作为正式交付件处理。

## Capabilities

### New Capabilities
- `audio-video-briefings`: 定义音频简报、视频简报和多模态交付对象。

### Modified Capabilities
- `studio-output-types`: 需要把音频、视频纳入正式输出类型，而不是临时附属功能。
- `publishable-artifacts`: 需要支持多模态产物的版本、封装、导出和外部交付语义。
- `output-rendering-and-typing`: 需要支持媒体元数据、播放状态和嵌入式渲染要求。
- `official-plugins`: 需要明确官方音视频插件的分发、兼容和质量承诺。

## Impact

- Backend：脚本装配、TTS / 渲染流水线、媒体存储、转码与交付元数据。
- Frontend：音频播放器、视频预览、生成入口、pack 集成和外部阅读页适配。
- Product：这会显著扩展结果的消费方式，也更容易形成“可分享”的产品感。
- Dependencies：建议接在 `c06-publish-and-share-knowledge-packs`、`c09-external-share-portals` 之后推进。
