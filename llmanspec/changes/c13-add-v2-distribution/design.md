## Approach

### 1. Single Binary (`bun build --compile`)

```bash
bun build --compile --outfile=crystalith-server ./server/src/server.ts
```

Targets: `bun-linux-x64`, `bun-darwin-arm64`, `bun-windows-x64`
Expected size: ~75MB (Bun runtime + Elysia + AI SDK + Drizzle + sqlite-vec + unpdf)

### 2. Frontend Embedding

Server serves frontend SPA via `@elysiajs/static`:
```ts
import { staticPlugin } from '@elysiajs/static';
app.use(staticPlugin({ assets: '../frontend/web/dist', prefix: '/' }));
```
Access `http://localhost:8032/` → full Crystalith SPA.

### 3. Server Mode (Optional)

For non-desktop deployments:
- `@elysiajs/jwt` for API authentication
- `elysia-rate-limit` for rate limiting
- Postgres adapter via `drizzle-orm/pg-core` (config toggle)

### 4. Tauri v2 Desktop Wrapper

```jsonc
// src-tauri/tauri.conf.json
{
  "bundle": {
    "externalBin": ["crystalith-server"],
    // .dmg / .exe / .AppImage
  }
}
```
Expected size: ~90MB (Tauri shell + Bun sidecar)

### 5. CI/CD Release

GitHub Actions matrix: 5 platform targets
Trigger: tag push → build → upload Release artifacts
