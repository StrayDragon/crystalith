from __future__ import annotations

import os

import uvicorn


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() not in {"0", "false", "no", "off"}


def main() -> None:
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8032"))
    reload_enabled = _env_bool("RELOAD", True)
    uvicorn.run(
        "crystalith.app:create_app",
        factory=True,
        host=host,
        port=port,
        reload=reload_enabled,
    )


if __name__ == "__main__":
    main()
