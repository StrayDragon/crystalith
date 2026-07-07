## Approach

Design decisions sourced from UPGRADES/ technical research and benchmark data.

## Tradeoffs

| Decision | Rationale | Alternative Rejected |
|----------|-----------|---------------------|
| See UPGRADES/00-v2-migration-plan.md | Full TypeScript rewrite, all features preserved | Partial rewrite, Python/TS hybrid |
| See UPGRADES/02-target-stack-bun.md | Bun --compile single binary (~75MB) | Electron (150-300MB), Python+PyInstaller (80-120MB) |

## Migration Notes

- BREAKING: v1 Python ↔ v2 TypeScript — no backward compatibility
- v1 data: one-time migration script (see add-v2-data-layer)
- v1 frontend: API client layer only — component logic reused
