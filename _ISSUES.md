# Issues

## 1) Chat conversion actions return 404

- [x] Area: Chat message actions -> "转换" menu.
- [x] Steps: Create/open a notebook; ask a question; use "转换" on assistant message ("段落/要点/结构化/转为来源").
- [x] Expected: creates corresponding output/source shown in Studio / Sources.
- [x] Actual: conversion succeeds and produces output/source.
- [x] Status: Fixed on 2026-01-28 (DevTools verified on notebook `test`).

## 2) Accessibility console warnings

- [x] Investigate and fix: "A form field element should have an id or name attribute".
- [x] Investigate and fix: "No label associated with a form field".
- [x] Status: Fixed on 2026-01-28 (added name/id/aria-label for inputs/selects/checkboxes).

## 3) Deep Research waiting_user plan missing after reload

- [x] Area: Deep Research detail panel when session is `waiting_user`.
- [x] Steps: Start session; reload UI after plan generated; open session detail dialog.
- [x] Expected: plan reasoning + query list render, with approve/skip/finish actions.
- [x] Actual: plan rendered from `session.steps` fallback; actions visible.
- [x] Status: Fixed on 2026-01-28 (DevTools verified on session "Apple 新闻").

## 4) Deep Research iteration counter not updated when plan generated

- [x] Area: Deep Research session badge/header iteration display.
- [x] Steps: Run research through at least one iteration; check `current_iteration` when iteration 2 plan is generated.
- [x] Expected: `current_iteration` increments to 2 and UI shows "第 2/4 轮".
- [x] Actual (pre-fix): session stayed at `current_iteration=1` while iteration 2 plan existed (session "Apple 新闻").
- [x] Verify fix on a new session created after 2026-01-28 change (session "Iteration verify after refresh", iter 2 plan shows and `current_iteration=2`).

## 5) Deep Research approval polling stuck after status change

- [x] Area: Deep Research background loop after user approves plan.
- [x] Steps: Start a research session; approve plan; observe progress.
- [x] Expected: background loop sees `waiting_user -> searching -> analyzing` and continues.
- [x] Actual (pre-fix): background loop kept stale `waiting_user` state and never progressed.
- [x] Status: Fixed on 2026-01-28 by refreshing session state in `WaitForApproval`.

# Progress / Verification

- [x] Completed UI verification using DevTools MCP with notebook `devtools-ui-check` (and after reload in `test`).
- [x] Created and deleted temporary notebooks `devtools-check-1` and `devtools-check-2`.
- [x] Added a new notebook `devtools-ui-check` for verification work.
- [x] Uploaded source `/tmp/devtools-upload.md`, opened source detail, and confirmed "放大查看" works.
- [x] Search results UI verified: search renders; Web menu + Fast/Deep Research menus open; "全屏查看" dialog opens; "作为链接导入" shows completion.
- [x] Search results inline list renders; "清空搜索结果" clears the list.
- [x] Chat response generated; "保存到笔记" and "复制" buttons clickable; "转换" menu used (404 fixed).
- [x] Chat response generated; "转换 -> 段落" and "转换 -> 转为来源" succeed and create items.
- [x] Studio: "闪卡" -> "自定义工具参数" dialog opens/closes successfully.
- [x] Studio: "添加笔记" flow verified; new note appears in Studio list.
- [x] "添加来源" tooltip appears (not full upload flow in this pass).
- [x] Source list menus: bulk menu opens (delete action shown); per-source menu opens with "放大查看/删除来源" and source detail dialog renders.
- [x] Deep Research: session "Apple 新闻" reaches `waiting_user`; plan detail renders; approve transitions to `searching`.
- [x] Deep Research: session "Test research" created for iteration progression verification.
- [x] Studio tools: custom params dialogs open for 指南/时间轴/思维导图/测验/报告/演示.
- [x] Studio outputs generated via API (latest IDs): GUIDE=14, TIMELINE=15, MINDMAP=16, QUIZ=17, BRIEFING=18, SLIDES=19.
- [x] Output menu: "放大查看" opens preview panel; "复制内容" executes. Output -> source conversion works via API (`POST /v1/notebooks/1/outputs/14/convert-to-source` => 201, source_id=10).
- [x] Slide UI preview verified: Slidev dialog opens and iframe syncs (http://localhost:3030/?t=1).
- [x] Destructive actions use a local popover/modal confirmation near the action (no `window.confirm`, no toast confirm).

# Remaining Verification (not yet completed)

- [ ] Studio item menus: rename/share still not found; menu shows 放大查看/转换为来源/复制内容/删除; delete not exercised.
- [x] "查看研究历史" flow: history dialog opens and lists completed session.
- [x] Deep Research iteration counter update: new session reaches iteration 2; UI shows "第 2/2 轮" and `current_iteration=2`.
