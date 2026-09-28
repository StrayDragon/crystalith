---
depends_on: ["c118-b-zone-frontend-components"]
---

# 顺延低难度可测项同批（~15 条，调研后批）

## Why

作战地图「顺延可测项调研」（2026-09-28，20 可测/10 缺口）判定出的低难度同批：全部有真实实现、锚点明确、仿既有测试范式即可，无需新基建。其中 r111（无 run URL deep link）调研发现 ResearchLabPage 存在被动 URL 恢复 runId 的代码路径，可能暴露真实违约——按纪律测试停在此处报告。

## What Changes

- web Rstest：r117（画布偏好零请求，fetch spy）、r442（sources 面板无深研残留，静态扫描）、r447（compose 后 badge 0→1，MSW mock listRuns）、r111（labRouting 断言，违约则停）、r299/r300/r301（Briefing 目录折叠/Guide 勾选进度/Flashcard 翻面导航）、r197（未知 output type decode 回退）、r462 同文件顺带补坏 export 回退用例（apiVersion 分支若确认缺口则停）
- server 单测/集成：r183/r184（Retry-After 与 timeout budget，ai/middleware fake LanguageModel 一套）、r261（web 搜索模式归一化不触 ResearchRun）、r202（POST outputs 按 OutputRead Zod 全字段断言）、r330（quality 修补循环管线分支）、r322（GET /v2/workspace/tools 注册发现）、r306（studioSlides.outputId FK 写入）
- 已覆盖规则补嵌套场景；测试暴露违约/缺陷的保持裸规则并报告；产品代码零改动。

## Capabilities

deep-research-ui、studio-output-types、generation-observability-and-guardrails、generation-presets-and-constraints、output-rendering-and-typing、typed-generation-framework、source-aware-generation-modes、data-and-storage、source-ingestion-core（以实际落点为准）

## Impact

review `pending` 126 → 约 111；web/server 测试面新增 ~15 组用例入 qa 门禁。
