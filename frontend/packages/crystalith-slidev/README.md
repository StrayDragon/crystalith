# crystalith-slidev

本包用于在本地启动 Slidev 预览服务，供工作区 iframe 预览使用。

- 默认读取 `data/output/preview/slides.md`
- 可通过 `SLIDEV_PREVIEW_PATH` 覆盖预览文件路径
- 默认端口 `3030`，可在命令中调整

启动：

```bash
pnpm -C frontend/packages/crystalith-slidev dev
```
