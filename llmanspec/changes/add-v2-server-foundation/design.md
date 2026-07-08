## Approach

Key tradeoffs and migration approach.

## Tradeoffs

| Decision | Rationale | Alternative Rejected |
|----------|-----------|---------------------|
| v2 full TS rewrite plan | Full TypeScript rewrite, all features preserved | Partial rewrite, Python/TS hybrid |
| Bun --compile benchmark (~75MB) | Bun --compile single binary (~75MB) | Electron (150-300MB), Python+PyInstaller (80-120MB) |

## Migration Notes

- BREAKING: v1 Python ↔ v2 TypeScript — no backward compatibility
- v1 data: one-time migration script (see add-v2-data-layer)
- v1 frontend: API client layer only — component logic reused
