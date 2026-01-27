## Why

当前演示工具需要进入对话框并手动触发生成，与其他 Studio 卡片的一键生成体验不一致；同时演示配置并未与 LLM 生成链路打通，导致输出风格与长度缺乏可控性，且缺少可复用的主题与 frontmatter 生成能力。

## What Changes

- **一键生成入口**：点击“演示”卡片即创建/更新草稿，并自动串联大纲与 Markdown 生成
- **演示生成参数**：提供数量、受众、结构模板、语气风格、语言、排版密度、主题预设与 frontmatter 生成等参数，可选自定义约束
- **配置持久化与复用**：参数保存到草稿，重新打开自动回填
- **LLM 提示词收敛**：后端根据参数组装 prompt，约束幻灯片数量、节奏、主题与 frontmatter

## Impact

- 受影响的规范：`studio-slides`
- 受影响的代码：
  - `frontend/web/src/features/workspace/components/StudioPanel.tsx`
  - `frontend/web/src/features/workspace/components/SlidesStudioDialog.tsx`
  - `frontend/web/src/features/workspace/hooks/useRefine.ts`
  - `backend/py/src/crystalith/api/slides.py`
  - `backend/py/src/crystalith/studio/slides/generator.py`
  - `backend/py/src/crystalith/db/models.py`
