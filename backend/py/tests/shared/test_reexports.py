from __future__ import annotations


def test_reexport_modules_import_cleanly() -> None:
    # These modules are thin re-exports; importing them should be safe and keeps
    # coverage honest (they are part of the public surface).
    import crystalith.app as _app  # noqa: F401
    import crystalith.shared.db.deps as _db_deps  # noqa: F401
    import crystalith.web.deps as _web_deps  # noqa: F401
