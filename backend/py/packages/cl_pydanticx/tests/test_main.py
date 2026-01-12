from __future__ import annotations

import json

import pytest
from pydantic import BaseModel

from cl_pydanticx import (
    BeforeValidators,
    DataJson,
    empty_str_in_json_to_empty_list_str,
    empty_str_in_json_to_none,
    json_to_bytes_serializer,
)


class _DataJsonPayload(BaseModel):
    title: str
    enabled: bool


class _DataJsonContainer(BaseModel):
    data_json: DataJson[_DataJsonPayload]


class TestJsonToBytesSerializer:
    """验证 ``json_to_bytes_serializer`` 的行为."""

    def test_raise_for_unsupported_type(self) -> None:
        """传入非 Pydantic 模型时应抛出 ``ValueError``."""

        with pytest.raises(ValueError, match="not support type"):  # noqa: PT011
            _ = json_to_bytes_serializer({"foo": "bar"})


class TestJsonNormalizationUtilities:
    """验证 JSON 预处理工具函数的行为."""

    def test_empty_str_in_json_to_none(self) -> None:
        """包含空字符串的 JSON 应转换为 ``None``."""

        empty_json = json.dumps([""])
        assert empty_str_in_json_to_none(empty_json) is None
        original = '{"value": "text"}'
        assert empty_str_in_json_to_none(original) == original

    def test_empty_str_in_json_to_empty_list_str(self) -> None:
        """包含空字符串的 JSON 应转换为 ``[]``."""

        empty_json = json.dumps([""])
        assert empty_str_in_json_to_empty_list_str(empty_json) == "[]"
        original = '{"value": "text"}'
        assert empty_str_in_json_to_empty_list_str(original) == original


class TestBeforeValidatorsIntegration:
    """验证 ``BeforeValidators`` 工具的集成效果."""

    class _OptionalJsonModel(BaseModel):
        data: BeforeValidators.AutoToNoneIfEmptyStrInList[str | None]

    class _EmptyListJsonModel(BaseModel):
        data: BeforeValidators.AutoToEmptyListIfEmptyStrInList[str]

    def test_auto_to_none_if_empty_string(self) -> None:
        """校验空字符串 JSON 自动转换为 ``None``."""

        empty_json = json.dumps([""])
        model = self._OptionalJsonModel(data=empty_json)
        assert model.data is None

        keep_original = "[]"
        model = self._OptionalJsonModel(data=keep_original)
        assert model.data == keep_original

    def test_auto_to_empty_list_if_empty_string(self) -> None:
        """校验空字符串 JSON 自动转换为 ``"[]"``."""

        empty_json = json.dumps([""])
        model = self._EmptyListJsonModel(data=empty_json)
        assert model.data == "[]"

        keep_original = '["value"]'
        model = self._EmptyListJsonModel(data=keep_original)
        assert model.data == keep_original


class TestDataJsonAlias:
    """验证 ``DataJson`` 类型别名的常见用法."""

    def test_accepts_model_instance(self) -> None:
        """``DataJson`` 应接受 Pydantic 模型实例."""

        payload = _DataJsonPayload(title="t", enabled=True)
        container = _DataJsonContainer(data_json=payload)

        assert isinstance(container.data_json, _DataJsonPayload)
        assert container.data_json.title == "t"
        assert container.data_json.enabled is True

    def test_accepts_json_string(self) -> None:
        """``DataJson`` 应接受 JSON 字符串并解析为模型实例."""

        raw = json.dumps({"title": "t", "enabled": False})
        container = _DataJsonContainer(data_json=raw)

        assert isinstance(container.data_json, _DataJsonPayload)
        assert container.data_json.title == "t"
        assert container.data_json.enabled is False
