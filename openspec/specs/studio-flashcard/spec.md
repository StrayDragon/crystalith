# studio-flashcard Specification

## Purpose

定义 Studio 中 FLASHCARD 类型输出的学习交互：提供可翻转卡片（点击/空格），并支持上一张/下一张导航与进度提示，形成轻量的自测体验。

## Related specs

- `GLOSSARY.md`
- `workspace-studio-ui/spec.md`
- `output-rendering/spec.md`
- `output-graph/spec.md`

## Requirements
### Requirement: 交互式闪卡翻转

系统 **MUST** 提供可翻转的闪卡界面，支持正面显示问题、背面显示答案。
用户点击闪卡或按下空格键时，当前闪卡 MUST 翻转；正面显示问题，背面显示答案。

### Requirement: 学习导航与进度

系统 **MUST** 提供闪卡浏览导航与进度提示。
用户点击上一张/下一张或使用左右方向键时 MUST 切换卡片，并 MUST 显示当前张数与总张数。
