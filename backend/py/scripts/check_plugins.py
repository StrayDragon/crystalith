from __future__ import annotations

import argparse
import json
from pathlib import Path

from crystalith.shared.config import ConfigManager
from crystalith.shared.plugins import PluginRegistry
from crystalith.shared.plugins.compliance import check_plugin


def main() -> int:
    parser = argparse.ArgumentParser(description="Crystalith plugin compliance checker")
    parser.add_argument(
        "--config-path",
        default="config/app.yaml",
        help="Path to config/app.yaml (default: config/app.yaml)",
    )
    parser.add_argument(
        "--schema-path",
        default="config/schema.json",
        help="Path to config/schema.json (default: config/schema.json)",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output JSON report",
    )
    args = parser.parse_args()

    manager = ConfigManager(Path(args.config_path), Path(args.schema_path))
    settings = manager.load()

    registry = PluginRegistry()
    report = registry.load_from_entry_points(settings)

    issues: dict[str, list[str]] = {}
    for plugin_id, plugin in registry.plugins.items():
        found = check_plugin(plugin_id, plugin)
        if found:
            issues[plugin_id] = found

    payload = {
        "loaded": report.loaded,
        "skipped": report.skipped,
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
