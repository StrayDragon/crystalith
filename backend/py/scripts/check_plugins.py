from __future__ import annotations

import argparse
import json
from pathlib import Path

from cl_logs import LogConfig, temporary_logging_config

from crystalith.shared.config import ConfigManager
from crystalith.shared.plugins import PLUGIN_API_VERSION, SUPPORTED_PLUGIN_API_VERSIONS, PluginRegistry
from crystalith.shared.plugins.compliance import check_plugin


def _resolve_default_path(value: str | None, *, relative: str) -> Path:
    if value:
        return Path(value)

    cwd_candidate = Path(relative)
    if cwd_candidate.is_file():
        return cwd_candidate

    repo_root = Path(__file__).resolve().parents[3]
    return repo_root / relative


def main() -> int:
    parser = argparse.ArgumentParser(description="Crystalith plugin compliance checker")
    parser.add_argument(
        "--config-path",
        default=None,
        help="Path to config/app.yaml (default: auto-detect)",
    )
    parser.add_argument(
        "--schema-path",
        default=None,
        help="Path to config/app.schema.json (default: auto-detect)",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output JSON report",
    )
    args = parser.parse_args()

    config_path = _resolve_default_path(args.config_path, relative="config/app.yaml")
    schema_path = _resolve_default_path(args.schema_path, relative="config/app.schema.json")

    manager = ConfigManager(config_path, schema_path)
    if args.json:
        with temporary_logging_config(LogConfig(level="CRITICAL", min_json_level="CRITICAL")):
            settings = manager.load()
    else:
        settings = manager.load()

    registry = PluginRegistry()
    report = registry.load_from_entry_points(settings)

    issues: dict[str, list[str]] = {}
    for plugin_id, plugin in registry.plugins.items():
        found = check_plugin(plugin_id, plugin)
        if found:
            issues[plugin_id] = found

    payload = {
        "host": {
            "plugin_api_version": PLUGIN_API_VERSION,
            "supported_api_versions": sorted(SUPPORTED_PLUGIN_API_VERSIONS),
        },
        "loaded": report.loaded,
        "skipped": {plugin_id: detail.to_dict() for plugin_id, detail in report.skipped.items()},
        "issues": issues,
    }

    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        print(f"Loaded plugins: {payload['loaded']}")
        if payload["skipped"]:
            print(f"Skipped plugins: {payload['skipped']}")
        if payload["issues"]:
            print("Compliance issues:")
            for plugin_id, plugin_issues in payload["issues"].items():
                print(f"- {plugin_id}")
                for issue in plugin_issues:
                    print(f"  - {issue}")

    return 1 if issues else 0


if __name__ == "__main__":
    raise SystemExit(main())
