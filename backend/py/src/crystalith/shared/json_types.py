from __future__ import annotations

# JSON-compatible types used across API payloads and config.
#
# Prefer these over `Any` so typecheckers force explicit narrowing when we need
# to interpret untrusted/dynamic data.

type JsonPrimitive = str | int | float | bool | None
type JsonValue = JsonPrimitive | list["JsonValue"] | dict[str, "JsonValue"]
type JsonDict = dict[str, JsonValue]
