# Crystalith

Crystalith is a notebook-centric AI workspace with RAG over your sources.

## Demo

<video controls muted playsinline width="100%" style="max-width: 960px;" poster="static/logo.webp">
  <source src="static/demo.webm" type="video/webm" />
  Your browser does not support the video tag.
</video>

## Links

- Docs: https://straydragon.github.io/crystalith/
- Repo: `https://github.com/StrayDragon/crystalith`

## Quick start

```bash
cp .env.example .env          # 选择 profile（默认 hybrid）
just upsert-env-configs       # 从 shell 环境变量填充 secrets
just up                       # 一键启动
```

四种运行模式，一条命令切换：

| Profile | 命令 | 说明 |
|---------|------|------|
| `local` | `just up local` | 纯本地开发，无 Docker |
| `hybrid` | `just up hybrid` | Docker 依赖 + 本地热重载（推荐） |
| `docker` | `just up docker` | Docker 部署 + 可选外部服务 |
| `full` | `just up full` | 全 Docker 部署 |

详见：`Getting Started` · `Optimal Config` · `Deployment`
