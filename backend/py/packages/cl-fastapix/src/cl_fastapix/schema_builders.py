"""OpenAPI schema 构建工具."""

from __future__ import annotations

from typing import Any

from cl_stdx.enumx import MetaInfoIntEnum, MetaInfoStrEnum


def _enum_to_schema(enum_cls: type[MetaInfoIntEnum | MetaInfoStrEnum], description: str | None = None) -> dict[str, Any]:
    is_int = issubclass(enum_cls, MetaInfoIntEnum)
    enum_values = [member.value for member in enum_cls]
    enum_descriptions = [f"* `{member.value}`: {member.x_meta.description}" for member in enum_cls]
    base_desc = description or "枚举值:"
    full_desc = f"{base_desc}\n\n" + "\n".join(enum_descriptions)

    return {
        "type": "integer" if is_int else "string",
        "enum": enum_values,
        "description": full_desc,
        "x-enum-module": enum_cls.__module__,
        "x-enum-class": enum_cls.__qualname__,
    }


def build_enum_schema(enum_cls: type[MetaInfoIntEnum | MetaInfoStrEnum], description: str | None = None) -> dict[str, Any]:
    """构建显式、可确定匹配的枚举 schema."""

    return _enum_to_schema(enum_cls, description)


def build_nullable_enum_schema(enum_cls: type[MetaInfoIntEnum | MetaInfoStrEnum], description: str | None = None) -> dict[str, Any]:
    """构建可空(anyOf)枚举 schema."""

    enum_branch = _enum_to_schema(enum_cls, description)
    return {"anyOf": [enum_branch, {"type": "null"}]}


def build_parameter(
    name: str,
    enum_cls: type[MetaInfoIntEnum | MetaInfoStrEnum],
    *,
    in_: str = "query",
    required: bool = True,
    description: str | None = None,
) -> dict[str, Any]:
    """构建携带显式枚举 schema 的参数定义."""

    return {
        "name": name,
        "in": in_,
        "required": required,
        "schema": build_enum_schema(enum_cls, description),
        "description": description or "",
    }
