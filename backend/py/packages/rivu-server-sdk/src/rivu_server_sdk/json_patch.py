from __future__ import annotations

from copy import deepcopy
from typing import Any


class JsonPatchError(Exception):
    pass


def _decode_pointer_token(token: str) -> str:
    return token.replace("~1", "/").replace("~0", "~")


def _pointer_tokens(path: str) -> list[str]:
    if path == "":
        return []
    if not path.startswith("/"):
        raise JsonPatchError("invalid JSON pointer")
    return [_decode_pointer_token(t) for t in path.split("/")[1:]]


def apply_json_patch(document: Any, patch: list[dict[str, Any]]) -> Any:
    doc = deepcopy(document)

    for op in patch:
        op_name = op.get("op")
        path = op.get("path")
        if not isinstance(op_name, str) or not isinstance(path, str):
            raise JsonPatchError("invalid operation")

        tokens = _pointer_tokens(path)
        if not tokens:
            raise JsonPatchError("root operations not supported")

        parent = doc
        for token in tokens[:-1]:
            if isinstance(parent, dict):
                if token not in parent:
                    raise JsonPatchError("path not found")
                parent = parent[token]
                continue
            if isinstance(parent, list):
                try:
                    idx = int(token)
                except ValueError as e:
                    raise JsonPatchError("invalid array index") from e
                if idx < 0 or idx >= len(parent):
                    raise JsonPatchError("index out of range")
                parent = parent[idx]
                continue
            raise JsonPatchError("path not found")

        last = tokens[-1]
        value = op.get("value", None)

        if isinstance(parent, dict):
            if op_name == "add":
                parent[last] = value
                continue
            if op_name == "replace":
                if last not in parent:
                    raise JsonPatchError("path not found")
                parent[last] = value
                continue
            raise JsonPatchError(f"unsupported op: {op_name}")

        if isinstance(parent, list):
            if last == "-" and op_name == "add":
                parent.append(value)
                continue
            try:
                idx = int(last)
            except ValueError as e:
                raise JsonPatchError("invalid array index") from e
            if op_name == "add":
                if idx < 0 or idx > len(parent):
                    raise JsonPatchError("index out of range")
                parent.insert(idx, value)
                continue
            if op_name == "replace":
                if idx < 0 or idx >= len(parent):
                    raise JsonPatchError("index out of range")
                parent[idx] = value
                continue
            raise JsonPatchError(f"unsupported op: {op_name}")

        raise JsonPatchError("path not found")

    return doc
