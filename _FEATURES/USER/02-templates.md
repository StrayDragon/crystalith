# 模板（Templates）

笔记本模板的选取、管理与另存为。

---

### `template-picker`

- **名称:** 模板选择器
- **位置:** 新建笔记本对话框
- **入口:** 创建笔记本时选择「从模板创建」
- **操作:** 浏览模板列表、预览描述、确认创建（带 `template_id`）
- **Server:** `GET /v2/templates`、`POST /v2/notebooks?template_id=`
- **代码:** `apps/web/src/features/workspace/domains/templates/TemplatePickerDialog.tsx`、`useTemplates.ts`
- **截图:** `screenshots/template-picker.png`（待截图）

> NOTE: 待盘点

---

### `template-manager`

- **名称:** 模板管理器
- **位置:** 设置/模板管理对话框
- **入口:** 系统配置或模板管理入口
- **操作:** 列表查看、编辑自定义模板、删除非内置模板
- **Server:** `GET /v2/templates`、`PATCH /v2/templates/:id`、`DELETE /v2/templates/:id`
- **代码:** `apps/web/src/features/workspace/domains/templates/TemplateManagerDialog.tsx`
- **截图:** `screenshots/template-manager.png`（待截图）

> NOTE: 待盘点

---

### `save-notebook-as-template`

- **名称:** 另存笔记本为模板
- **位置:** 模板保存对话框
- **入口:** 将当前笔记本结构保存为模板
- **操作:** 输入名称与描述，序列化 session_titles / source_tags 等到 `config_json`
- **Server:** `POST /v2/templates`
- **代码:** `apps/web/src/features/workspace/domains/templates/SaveTemplateDialog.tsx`
- **截图:** `screenshots/save-notebook-as-template.png`（待截图）

> NOTE: 待盘点
