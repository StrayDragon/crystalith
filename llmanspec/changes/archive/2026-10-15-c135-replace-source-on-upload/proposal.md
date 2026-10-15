---
title: 上传去重弹窗支持「替换旧来源」（内容更新工作流）
depends_on: []
branch: sdd/c135-replace-source-on-upload
base_branch: main
base_sha: bae87b4888347ca4709b675c0d06407058632f3e
---

# 上传去重弹窗支持「替换旧来源」

> c134 落地同名提示后遗留的语义缺口（2026-10-15 用户点名）：上传同名**更新版**文档时，
> 弹窗只能「跳过本次上传」或「两份共存」——「内容更新了想覆盖旧来源」需手动删旧再传。
> 本 change 在 upload 去重流增加 `replace` 动作与弹窗第三选项（仅 filename 命中时展示）。

## Why

- 更新文档是高频工作流；没有 replace 时同名提示反而挡路（必须取消 → 删旧 → 重传）。

## What Changes

- 上传 query `dedupAction` 增 `replace`：命中（内容或同名）时删除既有来源（向量/块/FTS
  级联）后按新字节正常摄取；响应即普通摄取结果。
- 前端弹窗 resolve 从布尔改三值（reuse / create_new / replace）；替换按钮仅
  kind='filename' 展示（内容完全相同时替换无意义）。
- URL 导入流不涉及（保持 reuse/create_new）。
- specs：`source-ingestion-upload-and-url` 新增 r491。

## BREAKING

无（新增可选动作；replace 生效面 = 一次删旧建新，与手动「删旧 + 重传」等价）。
