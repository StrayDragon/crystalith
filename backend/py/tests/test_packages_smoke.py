"""Smoke coverage for workspace packages with minimal assertions."""

from __future__ import annotations


def test_workspace_packages_smoke() -> None:
    from cl_fastapix import FastAPIX, enhance_openapi_schema
    from cl_logs import get_logger
    from cl_pydanticx import empty_str_in_json_to_empty_list_str, empty_str_in_json_to_none
    from cl_sqlalchemyx.mgrs.base import AsyncDBManager
    from cl_stdx.langx.optional import OptionT

    logger = get_logger("tests")
    assert logger is not None

    assert empty_str_in_json_to_none('[""]') is None
    assert empty_str_in_json_to_empty_list_str('[""]') == "[]"

    assert OptionT("ok").unwrap() == "ok"
    assert OptionT().is_none() is True

    assert FastAPIX is not None
    assert callable(enhance_openapi_schema)
    assert AsyncDBManager is not None
