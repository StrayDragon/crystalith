#!/usr/bin/env python3
"""Generate config/secret.env.example from template keys referenced in config/app.yaml."""

from __future__ import annotations

import argparse
import re
from pathlib import Path

from crystalith.shared.config.manager import _extract_namespace_keys

_SENSITIVE_ENV_SUFFIXES = (
    "_API_KEY",
    "_TOKEN",
    "_PASSWORD",
    "_SECRET",
)

_HEADER = """\
# Crystalith secrets (dotenv format) — AUTO-GENERATED; do not edit by hand.
#
# Regenerate:
#   cd backend/py && just secret-env-example
#
# Local dev: prefer `export KEY=...` in your shell (or `.env` for non-secret overrides).
# Docker: copy to config/secret.env and fill values (gitignored).
#
# Keys below are extracted from config/app.yaml template references.
"""


def _is_sensitive_env_key(key: str) -> bool:
    upper = key.upper()
    return any(upper.endswith(suffix) for suffix in _SENSITIVE_ENV_SUFFIXES)


def collect_template_keys(app_yaml: Path) -> tuple[list[str], list[str]]:
    source = app_yaml.read_text(encoding="utf-8")
    referenced = _extract_namespace_keys(source)
    secret_keys = sorted(referenced.get("secret", set()))
    env_keys = sorted(k for k in referenced.get("env", set()) if _is_sensitive_env_key(k))
    return secret_keys, env_keys


def render_secret_env_example(*, secret_keys: list[str], env_keys: list[str]) -> str:
    lines = [_HEADER.rstrip()]
    if secret_keys:
        lines.append("")
        lines.append("# secret.* template references (optional Docker deployments)")
        for key in secret_keys:
            lines.append(f"{key}=")
    if env_keys:
        lines.append("")
        lines.append("# env.* sensitive keys (export in shell or set in .env)")
        for key in env_keys:
            lines.append(f"# export {key}=")
            lines.append(f"{key}=")
    lines.append("")
    return "\n".join(lines)


def write_secret_env_example(
    *,
    app_yaml: Path,
    output_path: Path,
    check: bool = False,
) -> int:
    secret_keys, env_keys = collect_template_keys(app_yaml)
    rendered = render_secret_env_example(secret_keys=secret_keys, env_keys=env_keys)

    if check:
        if not output_path.is_file():
            print(f"Missing {output_path}. Run: cd backend/py && just secret-env-example")
            return 1
        existing = output_path.read_text(encoding="utf-8")
        if existing != rendered:
            print(
                f"{output_path} is out of date. Run: cd backend/py && just secret-env-example"
            )
            return 1
        return 0

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(rendered, encoding="utf-8")
    print(f"Wrote {output_path} ({len(secret_keys)} secret.* + {len(env_keys)} env.* keys)")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--app-yaml",
        type=Path,
        default=Path("../../config/app.yaml"),
        help="Path to config/app.yaml",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("../../config/secret.env.example"),
        help="Output path for secret.env.example",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Exit non-zero if output would change",
    )
    args = parser.parse_args()
    return write_secret_env_example(
        app_yaml=args.app_yaml.resolve(),
        output_path=args.output.resolve(),
        check=args.check,
    )


if __name__ == "__main__":
    raise SystemExit(main())
