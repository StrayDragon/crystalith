"""OpenAPI Schema 增强器 - 纯函数式实现."""

from __future__ import annotations

import enum
import logging
import sys
from typing import Any

from cl_stdx.enumx import MetaInfoIntEnum, MetaInfoStrEnum

OpenAPISchema = dict[str, Any]
EnumClass = type[MetaInfoIntEnum] | type[MetaInfoStrEnum]

_LOGGER = logging.getLogger("cl_fastapix.schema_enhancer")


def enhance_openapi_schema(schema: OpenAPISchema) -> OpenAPISchema:
    if not isinstance(schema, dict):
        return schema

    enhanced_schema = schema.copy()

    if "components" in enhanced_schema and "schemas" in enhanced_schema["components"]:
        enhanced_schema["components"]["schemas"] = enhance_component_schemas(
            enhanced_schema["components"]["schemas"],
        )

    if "paths" in enhanced_schema:
        enhanced_schema["paths"] = enhance_path_parameters(enhanced_schema["paths"])

    return enhanced_schema


def enhance_component_schemas(component_schemas: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(component_schemas, dict):
        return {}

    enhanced: dict[str, Any] = {}

    for schema_name, schema_def in component_schemas.items():
        enhanced[schema_name] = enhance_schema_recursive(schema_def, context_hint=schema_name)

    return enhanced


def enhance_path_parameters(paths: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(paths, dict):
        return {}

    enhanced_paths = {}

    for path, path_item in paths.items():
        enhanced_path_item = {}

        for method, operation in path_item.items():
            if isinstance(operation, dict):
                enhanced_operation: dict[str, Any] = operation.copy()

                if "parameters" in enhanced_operation:
                    enhanced_operation["parameters"] = [
                        enhance_parameter_schema(param, path, method) for param in enhanced_operation["parameters"]
                    ]

                if "requestBody" in enhanced_operation:
                    enhanced_operation["requestBody"] = enhance_request_body_schema(enhanced_operation["requestBody"])

                enhanced_path_item[method] = enhanced_operation
            else:
                enhanced_path_item[method] = operation

        enhanced_paths[path] = enhanced_path_item

    return enhanced_paths


def enhance_parameter_schema(param: dict[str, Any], path: str = "", method: str = "") -> dict[str, Any]:
    if not isinstance(param, dict) or "schema" not in param:
        return param

    enhanced_param = param.copy()
    param_name = param.get("name", "")

    context_hint = generate_context_hint(param_name, path, method)

    enhanced_param["schema"] = enhance_enum_schema(param["schema"], context_hint)

    if should_enhance_parameter_description(enhanced_param):
        enhanced_param = enhance_parameter_description(enhanced_param)

    return enhanced_param


def enhance_request_body_schema(request_body: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(request_body, dict) or "content" not in request_body:
        return request_body

    enhanced_body = request_body.copy()
    enhanced_content = {}

    for content_type, content_def in request_body["content"].items():
        if isinstance(content_def, dict) and "schema" in content_def:
            enhanced_content_def = content_def.copy()
            enhanced_content_def["schema"] = enhance_schema_recursive(
                content_def["schema"],
                context_hint=str(content_type),
            )
            enhanced_content[content_type] = enhanced_content_def
        else:
            enhanced_content[content_type] = content_def

    enhanced_body["content"] = enhanced_content
    return enhanced_body


def enhance_schema_recursive(schema: dict[str, Any], context_hint: str = "") -> dict[str, Any]:
    if not isinstance(schema, dict):
        return schema

    enhanced = schema.copy()

    if "$ref" in enhanced:
        return enhanced

    if "enum" in enhanced or "anyOf" in enhanced:
        enhanced = enhance_enum_schema(enhanced, context_hint)

    for key, value in enhanced.items():
        if key in ("properties", "additionalProperties", "items"):
            if isinstance(value, dict):
                if key == "properties":
                    enhanced[key] = {
                        prop_name: enhance_schema_recursive(
                            prop_schema,
                            context_hint=(f"{context_hint}_{prop_name}" if context_hint else str(prop_name)),
                        )
                        for prop_name, prop_schema in value.items()
                    }
                else:
                    next_context = f"{context_hint}_{key}" if context_hint else key
                    enhanced[key] = enhance_schema_recursive(value, context_hint=next_context)
            elif isinstance(value, list):
                enhanced[key] = [
                    enhance_schema_recursive(item, context_hint=context_hint) if isinstance(item, dict) else item for item in value
                ]
        elif key in ("allOf", "anyOf", "oneOf") and isinstance(value, list):
            enhanced[key] = [
                enhance_schema_recursive(item, context_hint=context_hint) if isinstance(item, dict) else item for item in value
            ]

    return enhanced


def enhance_enum_schema(schema: dict[str, Any], context_hint: str = "") -> dict[str, Any]:
    if not isinstance(schema, dict):
        return schema

    if "anyOf" in schema:
        has_enum_in_anyof = any(isinstance(item, dict) and "enum" in item for item in schema.get("anyOf", []))
        if has_enum_in_anyof:
            return _enhance_anyof_enum_schema(schema, context_hint)

        if "enum" in schema:
            enhanced = _enhance_direct_enum_schema(schema, context_hint)

            anyof_list = schema.get("anyOf", [])
            contains_null = any(isinstance(item, dict) and item.get("type") == "null" for item in anyof_list)
            if not contains_null:
                normalized = enhanced.copy()
                enum_values = normalized.get("enum", [])
                if enum_values and all(isinstance(v, int) for v in enum_values):
                    normalized["type"] = "integer"
                elif enum_values and all(isinstance(v, str) for v in enum_values):
                    normalized["type"] = "string"
                normalized.pop("anyOf", None)
                return normalized

            return enhanced

        return _enhance_anyof_enum_schema(schema, context_hint)

    if "enum" in schema:
        return _enhance_direct_enum_schema(schema, context_hint)

    return schema


def _enhance_direct_enum_schema(schema: dict[str, Any], _context_hint: str = "") -> dict[str, Any]:
    enum_values = schema.get("enum", [])
    if not enum_values:
        return schema

    enum_class = None
    enum_module = schema.get("x-enum-module")
    enum_class_name = schema.get("x-enum-class")

    if enum_module and enum_class_name:
        try:
            mod = sys.modules.get(enum_module)
            if mod is None:
                __import__(enum_module)
                mod = sys.modules.get(enum_module)
            candidate = getattr(mod, enum_class_name.split(".")[-1], None)
            if candidate and _is_metainfo_enum_class(candidate):
                class_values = [member.value for member in candidate]
                if set(class_values) == set(enum_values):
                    enum_class = candidate
        except Exception:  # pragma: no cover - best effort probing
            enum_class = None

    if not enum_class:
        return schema

    enhanced_description = generate_enhanced_description(enum_class, schema.get("description", ""))

    if enhanced_description:
        enhanced_schema = schema.copy()
        enhanced_schema["description"] = enhanced_description
        return enhanced_schema

    return schema


def _enhance_anyof_enum_schema(schema: dict[str, Any], context_hint: str = "") -> dict[str, Any]:
    anyof_list = schema.get("anyOf", [])
    if not anyof_list:
        return schema

    enhanced_schema: dict[str, Any] = schema.copy()
    enhanced_anyof: list[dict[str, Any]] = []

    for item in anyof_list:
        if isinstance(item, dict):
            if "enum" in item:
                enhanced_item = _enhance_direct_enum_schema(item, context_hint)
                enhanced_anyof.append(enhanced_item)
            elif "anyOf" in item:
                enhanced_item = _enhance_anyof_enum_schema(item, context_hint)
                enhanced_anyof.append(enhanced_item)
            else:
                enhanced_anyof.append(item)
        else:
            enhanced_anyof.append(item)

    enhanced_schema["anyOf"] = enhanced_anyof
    return enhanced_schema


def generate_context_hint(param_name: str, path: str = "", method: str = "") -> str:
    hints = [param_name]

    if method:
        hints.append(method.lower())

    if path:
        path_parts = [p for p in path.split("/") if p and not p.startswith("{")]
        hints.extend(path_parts)

    return "_".join(hints)


def generate_enhanced_description(enum_class: EnumClass, original_description: str = "") -> str:
    try:
        descriptions = [
            f"* `{member.value}`: {member.x_meta.description}"
            for member in enum_class
            if hasattr(member, "x_meta") and hasattr(member.x_meta, "description")
        ]

        if not descriptions:
            return original_description

        if original_description and any(f"`{member.value}`:" in original_description for member in enum_class):
            return original_description

        base_description = original_description or "枚举值:"
        enhanced_description = f"{base_description}\n\n" + "\n".join(descriptions)

    except Exception:  # pragma: no cover - defensive
        return original_description
    else:
        return enhanced_description


def should_enhance_parameter_description(param: dict[str, Any]) -> bool:
    if not isinstance(param, dict):
        return False

    schema = param.get("schema", {})
    param_desc = param.get("description", "")

    if not _has_enum_in_schema(schema):
        return False

    schema_desc = _get_enum_description_from_schema(schema)

    return "`" in schema_desc and "`" not in param_desc


def enhance_parameter_description(param: dict[str, Any]) -> dict[str, Any]:
    if not should_enhance_parameter_description(param):
        return param

    enhanced_param = param.copy()
    schema = param.get("schema", {})
    schema_desc = _get_enum_description_from_schema(schema)
    param_desc = param.get("description", "")

    if "`" in schema_desc and schema_desc != param_desc:
        enhanced_param["description"] = schema_desc

    return enhanced_param


def _is_metainfo_enum_class(attr: Any) -> bool:
    if not attr or not isinstance(attr, type):
        return False

    try:
        if not issubclass(attr, enum.Enum):
            return False

        try:
            members = list(attr)
            if not members:
                return False

            first_member = members[0]
            if not hasattr(first_member, "x_meta"):
                return False

            x_meta = getattr(first_member, "x_meta", None)
            if not x_meta or not hasattr(x_meta, "description"):
                return False

        except Exception:  # pragma: no cover - defensive
            return False

        else:
            return True

    except Exception:  # pragma: no cover - defensive
        return False


def _get_enum_description_from_schema(schema: dict[str, Any]) -> str:
    if not isinstance(schema, dict):
        return ""

    if "anyOf" in schema and isinstance(schema["anyOf"], list):
        for item in schema["anyOf"]:
            if isinstance(item, dict) and "enum" in item:
                enum_desc = item.get("description", "")
                if enum_desc and "`" in enum_desc:
                    return enum_desc

    if "description" in schema:
        return schema["description"]

    if "anyOf" in schema and isinstance(schema["anyOf"], list):
        for item in schema["anyOf"]:
            if isinstance(item, dict) and "description" in item:
                return item["description"]

    return ""


def _has_enum_in_schema(schema: dict[str, Any]) -> bool:
    if not isinstance(schema, dict):
        return False

    if "enum" in schema and isinstance(schema["enum"], list) and schema["enum"]:
        return True

    if "anyOf" in schema and isinstance(schema["anyOf"], list):
        for item in schema["anyOf"]:
            if isinstance(item, dict):
                if "enum" in item and isinstance(item["enum"], list) and item["enum"]:
                    return True
                if _has_enum_in_schema(item):
                    return True

    return False
