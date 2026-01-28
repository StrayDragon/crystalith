# Issues

## 1) Chat conversion actions return 404

- Area: Chat message actions -> "转换" menu
- Steps:
  1. Create/open a notebook (tested in `devtools-ui-check` and existing `test`).
  2. Ask a question so a response appears.
  3. Click "转换" on the assistant message and choose:
     - "段落"
     - "要点"
     - "结构化"
     - "转为来源"
- Expected: create a corresponding output/source and show it in Studio / Sources.
- Actual: browser alert appears: "转换失败：Not Found." No output/source created.
- Notes: The alert blocks further UI interaction until dismissed. Repro after reload.

## 2) Accessibility console warnings

- Observed Chrome console issues (not functionally blocking, but worth tracking):
  - "A form field element should have an id or name attribute"
  - "No label associated with a form field"

# Progress / Verification

- Completed UI verification using DevTools MCP with notebook `devtools-ui-check` (and after reload in `test`).
- Created and deleted temporary notebooks `devtools-check-1` and `devtools-check-2`.
- Added a new notebook `devtools-ui-check` for verification work.
- Uploaded source `/tmp/devtools-upload.md`, opened source detail, and confirmed "放大查看" works.
- Search results UI verified: search renders results; Web menu and Fast/Deep Research menu open; "全屏查看" dialog opens; "作为链接导入" shows completion.
- Chat response generated; "保存到笔记" and "复制" buttons clickable; "转换" menu triggers 404 alert (Issue #1).
- Studio: "闪卡" -> "自定义工具参数" dialog opens/closes successfully.
- "添加来源" tooltip appears (not full upload flow in this pass).

# Remaining Verification (not yet completed)

- Studio tools: 指南 / 时间轴 / 思维导图 / 测验 / 报告 / 演示 actions + custom params and generation.
- Studio item menus (rename/delete/share/etc.) and "添加笔记".
- Source list bulk menu + per-source menu actions.
- "查看研究历史" and "清空搜索结果" flows.
- End-to-end output generation from Studio (new run on current notebook).
