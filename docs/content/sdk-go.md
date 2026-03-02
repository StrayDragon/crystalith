# Go SDK

## Overview
The Go SDK is generated from the backend OpenAPI schema via Fern and stored in:

- `vendor/crystalith-sdks/go` (git submodule)

Fern configuration lives in:
- `sdk/configs/fern/fern.config.json`
- `sdk/configs/fern/generators.yml` (group: `go-sdk`)

## Local generation (repo)

```bash
git submodule update --init --recursive vendor/crystalith-sdks
just api-export
just sdk-gen-go
```

## Go proxy notes
Fern local generation runs the Go generator inside Docker. Fern does **not** pass your local `GOPROXY` /
`GOSUMDB` environment variables into the generator container, so Go module downloads may fail on networks
that cannot reach `proxy.golang.org`.

To make generation reliable, `just sdk-gen-go` can patch the local Docker image tag
`fernapi/fern-go-sdk:1.26.0` by rebuilding it from `sdk/generators/fern-go-sdk/Dockerfile` with these
defaults:

- `GOPROXY=https://goproxy.cn,https://goproxy.io,direct`
- `GOSUMDB=sum.golang.google.cn`

### Environment variables

- `FERN_GO_SDK_PATCH_IMAGE`
  - `auto` (default): patch only when `https://proxy.golang.org` is not reachable
  - `1`: always patch (useful on CN networks / CI)
  - `0`: never patch (use the upstream image as-is)

### Custom mirrors
If you want different mirrors (e.g. a company proxy), edit `sdk/generators/fern-go-sdk/Dockerfile` and
rerun `just sdk-gen-go`.

## Versioning / publishing notes
- Go module versions come from git tags (not a `go.mod` version field).
- In `crystalith-sdks`, tags use the Go subdir prefix: `go/vX.Y.Z`.
- The module path is configured as `github.com/StrayDragon/crystalith-sdks/go`. If you publish the Go SDK from a different repo/path, update `module.path` in `sdk/configs/fern/generators.yml`.
