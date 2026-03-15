# Go SDK

## 概述
Go SDK 由后端 OpenAPI schema 通过 Fern 生成，存放于：

- `vendor/crystalith-sdks/go`（git 子模块）

Fern 配置位于：
- `sdk/configs/fern/fern.config.json`
- `sdk/configs/fern/generators.yml`（分组：`go-sdk`）

## 本地生成（仓库内）

```bash
git submodule update --init --recursive vendor/crystalith-sdks
just api-export
just sdk-gen-go
```

## Go proxy 说明
Fern 本地生成在 Docker 内运行 Go 生成器。Fern **不会**将本地的 `GOPROXY` / `GOSUMDB` 环境变量传入生成器容器，因此在无法访问 `proxy.golang.org` 的网络环境下，Go 模块下载可能失败。

为保证生成可靠，`just sdk-gen-go` 可通过 `sdk/generators/fern-go-sdk/Dockerfile` 重新构建本地 Docker 镜像 `fernapi/fern-go-sdk:1.26.0`，并应用以下默认配置：

- `GOPROXY=https://goproxy.cn,https://goproxy.io,direct`
- `GOSUMDB=sum.golang.google.cn`

### 环境变量

- `FERN_GO_SDK_PATCH_IMAGE`
  - `auto`（默认）：仅在无法访问 `https://proxy.golang.org` 时打补丁
  - `1`：始终打补丁（适用于国内网络 / CI）
  - `0`：从不打补丁（使用上游镜像原样）

### 自定义镜像
如需使用其他镜像（如公司代理），请编辑 `sdk/generators/fern-go-sdk/Dockerfile` 后重新执行 `just sdk-gen-go`。

## 版本管理 / 发布说明
- Go 模块版本来自 git tag（而非 `go.mod` 中的 version 字段）。
- 在 `crystalith-sdks` 中，tag 使用 Go 子目录前缀：`go/vX.Y.Z`。
- 模块路径配置为 `github.com/StrayDragon/crystalith-sdks/go`。若从其他仓库/路径发布 Go SDK，请更新 `sdk/configs/fern/generators.yml` 中的 `module.path`。
