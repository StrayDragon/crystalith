## 7.1 Behavior Changes

- Runtime topology default changed to core-only (`frontend/backend` -> compose `web/api`).
- Optional services are now explicit overlays and report unified runtime status via `/health/dependencies`.
- Optional service runtime state now includes `status`, `healthy`, `last_probe`, `error_code`, and `recovery_hint`.
- Optional cache failures are fail-open for primary flows (vector search cache + source cache epoch bumps).
- Monitor env naming changed from Ollama-specific to optional-service-wide namespace.

## 7.2 Migration Notes

### Command mapping

- `just dev-up` -> `just dev-docker-up`
- `just dev-down` -> `just dev-docker-down`
- `just dev-ps` -> `just dev-docker-ps`
- `just dev-logs` -> `just dev-docker-logs`
- `just dev-rebuild <service>` -> `just dev-docker-rebuild <service>`
- `just dev-smoke` -> `just dev-docker-smoke`

### Env mapping

- `CRYSTALITH_OLLAMA_MONITOR_ENABLED` -> `CRYSTALITH_OPTIONAL_SERVICES_MONITOR_ENABLED`
- `CRYSTALITH_OLLAMA_MONITOR_INTERVAL_S` -> `CRYSTALITH_OPTIONAL_SERVICES_MONITOR_INTERVAL_S`
- `CRYSTALITH_OLLAMA_MONITOR_TIMEOUT_S` -> `CRYSTALITH_OPTIONAL_SERVICES_MONITOR_TIMEOUT_S`
- `CRYSTALITH_OLLAMA_MONITOR_INCLUDE_ENV_HOST` -> `CRYSTALITH_OPTIONAL_SERVICES_MONITOR_INCLUDE_ENV_HOST`

### Rollback path

- To approximate previous full-stack startup behavior, explicitly enable all overlays:
  `just DEV_OPTIONALS="storage redis ollama slidev" dev-docker-up`
