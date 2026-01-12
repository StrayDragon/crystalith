import dataclasses
import enum
from typing import Any

from pydantic import GetJsonSchemaHandler
from pydantic.json_schema import JsonSchemaValue
from pydantic_core import ValidationError as PydanticValidationError
from pydantic_core import core_schema


@dataclasses.dataclass(frozen=True, slots=True)
class XMetaInfo:
    description: str = ""
    display_text: str = ""


class MetaInfoIntEnum(enum.IntEnum):
    """
    IntEnum with XMetaInfo

    Most of behavior like IntEnum, and you can use ._x_meta to get the pre-defined XMetaInfo
    """

    def __new__(cls, value: int, meta: XMetaInfo) -> "MetaInfoIntEnum":
        obj = int.__new__(cls, value)
        obj._value_ = value
        obj._x_meta = meta  # pyright: ignore[reportAttributeAccessIssue ]
        return obj

    @classmethod
    def to_db_field_comment(cls) -> str:
        return " ".join([f"{i.value}: {i.x_meta.description}" for i in cls])

    @property
    def x_meta(self) -> XMetaInfo:
        return self._x_meta  # pyright: ignore[reportAttributeAccessIssue,reportUnknownMemberType,reportUnknownVariableType ]

    @classmethod
    def __get_pydantic_core_schema__(cls, source_type: Any, handler: Any) -> core_schema.CoreSchema:
        base_schema = handler(source_type)

        def wrap_validator(value: Any, validator: core_schema.ValidatorFunctionWrapHandler) -> enum.Enum:
            if isinstance(value, cls):
                return validator(value)

            original_value = value

            if isinstance(value, str):
                try:
                    value = int(value)
                except (ValueError, TypeError) as exc:
                    raise ValueError(f"'{original_value}' is not a valid member of {cls.__name__}") from exc

            try:
                return validator(value)
            except (PydanticValidationError, TypeError, ValueError) as exc:
                raise ValueError(f"'{original_value}' is not a valid value for {cls.__name__}") from exc

        schema = core_schema.no_info_wrap_validator_function(wrap_validator, base_schema)
        schema["serialization"] = core_schema.plain_serializer_function_ser_schema(lambda x: x.value if hasattr(x, "value") else x)
        return schema

    @classmethod
    def __get_pydantic_json_schema__(cls, core_schema: core_schema.CoreSchema, handler: GetJsonSchemaHandler) -> JsonSchemaValue:
        json_schema = handler(core_schema)
        json_schema = handler.resolve_ref_schema(json_schema)

        descriptions = [f"* `{member.value}`: {member._x_meta.description}" for member in cls]  # pyright: ignore[reportAttributeAccessIssue,reportUnknownMemberType]
        schema_description = "枚举值:\n\n" + "\n".join(descriptions)

        # 为 MetaInfoIntEnum 明确设置为 integer 类型(不支持 string)
        json_schema.update(
            type="integer",
            description=schema_description,
            enum=[member.value for member in cls],
            **{
                "x-enum-module": cls.__module__,
                "x-enum-class": cls.__qualname__,
            },
        )
        return json_schema


class MetaInfoStrEnum(str, enum.Enum):
    """
    StrEnum with XMetaInfo

    Most of behavior like StrEnum, and you can use ._x_meta to get the pre-defined XMetaInfo
    """

    def __new__(cls, value: str, meta: XMetaInfo) -> "MetaInfoStrEnum":
        obj = str.__new__(cls, value)
        obj._value_ = value
        obj._x_meta = meta  # pyright: ignore[reportAttributeAccessIssue ]
        return obj

    @classmethod
    def to_db_field_comment(cls) -> str:
        return " ".join([f"{i.value}: {i.x_meta.description}" for i in cls])

    @property
    def x_meta(self) -> XMetaInfo:
        return self._x_meta  # pyright: ignore[reportAttributeAccessIssue,reportUnknownMemberType,reportUnknownVariableType ]

    @classmethod
    def __get_pydantic_core_schema__(cls, source_type: Any, handler: Any) -> core_schema.CoreSchema:
        base_schema = handler(source_type)

        def wrap_validator(value: Any, validator: core_schema.ValidatorFunctionWrapHandler) -> enum.Enum:
            if isinstance(value, cls):
                return validator(value)

            if isinstance(value, str):
                try:
                    return validator(cls(value))
                except ValueError:
                    try:
                        member = cls[value.upper()]
                    except KeyError as exc:
                        raise ValueError(f"'{value}' is not a valid value or name for {cls.__name__}") from exc
                    return validator(member)

            raise ValueError(f"Input for {cls.__name__} must be a string.")

        schema = core_schema.no_info_wrap_validator_function(wrap_validator, base_schema)
        schema["serialization"] = core_schema.plain_serializer_function_ser_schema(lambda x: x.value if hasattr(x, "value") else x)
        return schema

    @classmethod
    def __get_pydantic_json_schema__(cls, core_schema: core_schema.CoreSchema, handler: GetJsonSchemaHandler) -> JsonSchemaValue:
        json_schema = handler(core_schema)
        json_schema = handler.resolve_ref_schema(json_schema)

        descriptions = [f"* `{member.value}`: {member._x_meta.description}" for member in cls]  # pyright: ignore[reportAttributeAccessIssue,reportUnknownMemberType]
        schema_description = "枚举值:\n\n" + "\n".join(descriptions)

        # 为 MetaInfoStrEnum 明确设置为 string 类型
        json_schema.update(
            type="string",
            description=schema_description,
            enum=[member.value for member in cls],
            **{
                "x-enum-module": cls.__module__,
                "x-enum-class": cls.__qualname__,
            },
        )
        return json_schema


class EnumField:
    """
    EnumField is a field (descriptor) that can be used to validate and serialize enum values.

    It will automatically convert the value to the enum member, and you can use ._x_meta to get the pre-defined XMetaInfo
    """

    def __init__(self, enum_cls: type[enum.Enum]) -> None:
        if not issubclass(enum_cls, enum.Enum):
            raise TypeError("enum_cls must be subclass of enum.Enum")
        self.enum_cls = enum_cls
        self.private_name = None

    def __set_name__(self, owner: Any, name: str) -> None:
        self.private_name = f"_{name}"

    def __get__(self, instance: Any, owner: Any) -> Any:
        if instance is None:
            return self
        if self.private_name is None:
            return None
        return getattr(instance, self.private_name, None)

    def __set__(self, instance: Any, value: Any) -> None:
        if value is None:
            setattr(instance, self.private_name, None)  # pyright: ignore[reportArgumentType]
            return

        try:
            member = self.enum_cls(value)
        except ValueError:
            try:
                if not isinstance(value, str):
                    raise KeyError  # noqa: TRY301
                member = self.enum_cls[value.upper()]
            except KeyError:
                raise ValueError(f"'{value}' is not a valid member, value or name for {self.enum_cls.__name__}") from None

        setattr(instance, self.private_name, member)  # pyright: ignore[reportArgumentType]
