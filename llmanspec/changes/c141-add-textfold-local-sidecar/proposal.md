---
depends_on: []
---

# 本机 TextFold sidecar（折叠阅读，不进插件 kind）

本草案不实现。倾向已锁定为探索结论中的选项 B；落实时走完整 propose。不阻塞 c139 parser 对外。

## Why

- TextFold 的价值是五层缩放阅读（全文 → 简述原句 → 关键句 → 要点 → 主题地图），不是 Studio 再生成一种 FAQ/指南。
- Crystalith 插件必须纯 JS、进单二进制；TextFold 是 Python。做成 `@crystalith-plugin/*` 会破 c13 分发。
- 没有「全局插件」kind。硬塞进 `output-type` 会同时撞开长期关闭的生成插件面。

## What Changes（正式化时）

- Crystalith **可选**发现本机 TextFold：读其 data 目录里的 `server.json`（`format: textfold/server`），对 `http://127.0.0.1:<port>` 调 `GET /api/doc/...` 或等价的 `textfold get`。
- 未安装 / 未在跑：功能降级，诊断里给恢复提示（安装 Python 包或桌面 App），不阻断启动。
- 折叠对象优先：来源正文、研究报告；QA 长答后做。
- 开放格式对齐 `textfold/doc`（只读消费，不自造平行格式）。
- **不**新增 CrystalithPlugin kind，**不**把折叠写成 OUTPUT_META 第七种类型。

## 非目标

- 不把 Python 运行时打进 crystalith-server 单二进制。
- 不重写 ladder 引擎为 TS（除非 sidecar 验证后证明值得内嵌，那是另一个 change）。
- 不收编 TextFold 的 arXiv/PMC 抽取器当本 change 的范围（arxiv 已有 extractor 榜样；github/docx 走插件梯队）。

## Open Questions

- 第一刀表面：来源阅读 vs 研究报告（倾向两者都做，来源先行）。
- 折叠用 TextFold 已连接的模型，还是把正文交给 Crystalith 自己的 LLM、只复用格式与 UI？sidecar 方案默认前者。
- 是否允许「本机没有 TextFold 时，用纯 TS 的本地降级折叠」（仅 Brief=前几句，不调模型）——产品是否值得。
