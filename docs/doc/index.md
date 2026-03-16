# Crystalith

Crystalith 是一个以笔记本为中心的 AI 工作空间，支持对你的资料进行 RAG 检索增强生成。

## 演示

<video controls muted playsinline width="100%" style="max-width: 960px;" poster="static/logo.webp">
  <source src="static/demo.webm" type="video/webm" />
  你的浏览器不支持 video 标签。
</video>

## 链接

- 文档: https://straydragon.github.io/crystalith/
- 仓库: `https://github.com/StrayDragon/crystalith`

## 快速开始

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

详见：`快速上手` · `最佳配置` · `部署与开发`
