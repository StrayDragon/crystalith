"""
Pydantic 扩展工具包

提供常用的 Pydantic 字段定义和序列化工具
"""

from typing import Annotated, Any, TypeVar

from pydantic import BaseModel, BeforeValidator
from pydantic import Json as BaseModelJson

T = TypeVar("T")
BaseModelT = TypeVar("BaseModelT", bound=BaseModel)


def json_to_bytes_serializer(value: Any) -> bytes:
    """
    将 JSON 字段序列化为 bytes 类型的便利函数

    在 @field_serializer 中使用此函数来将 JSON 字段转换为 bytes

    Args:
        value: 可能是 Pydantic 模型对象或已解析的 Python 对象

    Returns:
        编码为 UTF-8 的 bytes

    Example:
        ```python
        from pydantic import BaseModel, field_serializer
        from pydantic import Json as BaseModelJson
        from cl_pydanticx import json_to_bytes_serializer


        class MyCU(StdBaseCU):
            data_json: BaseModelJson[MyData] = MyData()

            @field_serializer("data_json")
            def serialize_data_json(self, value: Any) -> bytes:
                return json_to_bytes_serializer(value)
        ```
    """
    # 如果是 Pydantic 模型对象,直接使用 model_dump_json
    if isinstance(value, BaseModel):
        return value.model_dump_json().encode("utf-8")
    raise ValueError(f"not support type: {type(value)}")


DataJson = BaseModelJson[BaseModelT] | BaseModelT


def empty_str_in_json_to_none(value: str) -> str | None:
    """
    Pydantic `Json` 类型的 `BeforeValidator`.
    如果传入的JSON字符串包含空字符串(例如 '[""]'), 则返回 None.
    """
    if '""' in value:
        return None
    return value


def empty_str_in_json_to_empty_list_str(value: str) -> str:
    """
    Pydantic `Json` 类型的 `BeforeValidator`.
    如果传入的JSON字符串包含空字符串(例如 '[""]'), 则返回 '[]'.
    """
    if '""' in value:
        return "[]"
    return value


class BeforeValidators:
    AutoToNoneIfEmptyStrInList = Annotated[T, BeforeValidator(empty_str_in_json_to_none)]

    AutoToEmptyListIfEmptyStrInList = Annotated[T, BeforeValidator(empty_str_in_json_to_empty_list_str)]


__all__ = (
    "BeforeValidators",
    "DataJson",
    "empty_str_in_json_to_empty_list_str",
    "empty_str_in_json_to_none",
    "json_to_bytes_serializer",
)
