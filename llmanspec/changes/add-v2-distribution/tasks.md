# add-v2-distribution — Tasks

## 1. Single Binary
- [ ] `bun build --compile --outfile=crystalith-server ./src/server.ts`
- [ ] 验证: 三平台编译成功 (linux-x64/darwin-arm64/windows-x64)
- [ ] 验证: 二进制大小 < 90MB

## 2. Frontend Embedding
- [ ] Server 内嵌 frontend dist/ — 与 binary 同目录 public/
- [ ] Elysia static plugin 服务 frontend
- [ ] 验证: 访问 localhost:8032 → frontend SPA

## 3. Server Mode (Optional)
- [ ] JWT 认证 (Elysia jwt plugin)
- [ ] Rate Limiting
- [ ] Postgres 适配 (drizzle-orm/pg-core)，通过 config 切换

## 4. Tauri Wrapper
- [ ] `src-tauri/` — Tauri v2 Rust shell + externalBin
- [ ] 验证: .dmg/.exe/.AppImage 产出 < 100MB

## 5. CI/CD Release
- [ ] GitHub Actions release.yml: 5 platform matrix
- [ ] 验证: tag push → 自动构建 + 上传 Release artifacts

## Verification
```bash
bun build --compile --outfile=crystalith-server ./src/server.ts
./crystalith-server &
curl localhost:8032/health
curl localhost:8032/
kill %1
```

