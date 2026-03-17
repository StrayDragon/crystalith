"""
测试 libs.pydanticx 的 JSON bytes 序列化功能
"""

import json
from typing import Any

import pytest
from cl_pydanticx import json_to_bytes_serializer
from pydantic import BaseModel, ValidationError, field_serializer
from pydantic import Json as BaseModelJson


class TestJsonToBytesSerializer:
    """测试 json_to_bytes_serializer 函数"""

    def test_serialize_pydantic_model(self):
        """测试序列化 Pydantic 模型"""

        class TestModel(BaseModel):
            name: str
            value: int

        model = TestModel(name="test", value=123)
        result = json_to_bytes_serializer(model)

        assert isinstance(result, bytes)

        decoded = result.decode("utf-8")
        parsed = json.loads(decoded)
        assert parsed == {"name": "test", "value": 123}


class TestFieldSerializerIntegration:
    """测试与 @field_serializer 集成"""

    def test_field_serializer_with_json_type(self):
        """测试在 @field_serializer 中使用 json_to_bytes_serializer"""

        class DataModel(BaseModel):
            title: str
            count: int = 0

        class TestCU(BaseModel):
            data_json: BaseModelJson[DataModel] = DataModel(title="default")

            @field_serializer("data_json")
            def serialize_data_json(self, value) -> bytes:
                return json_to_bytes_serializer(value)

        # 测试 JSON 字符串输入
        json_input = '{"title": "test", "count": 5}'
        cu = TestCU(data_json=json_input)

        # 验证解析成功
        assert isinstance(cu.data_json, DataModel)
        assert cu.data_json.title == "test"
        assert cu.data_json.count == 5

        # 验证序列化为 bytes
        dumped = cu.model_dump()
        assert isinstance(dumped["data_json"], bytes)

        # 验证序列化内容
        decoded = dumped["data_json"].decode("utf-8")
        parsed = json.loads(decoded)
        assert parsed == {"title": "test", "count": 5}

    def test_field_serializer_with_default_value(self):
        """测试默认值的序列化"""

        class DataModel(BaseModel):
            name: str = "default"
            enabled: bool = True

        class TestCU(BaseModel):
            config: BaseModelJson[DataModel] = DataModel()

            @field_serializer("config")
            def serialize_config(self, value) -> bytes:
                return json_to_bytes_serializer(value)

        # 不提供值,使用默认值
        cu = TestCU()

        assert cu.config.name == "default"
        assert cu.config.enabled is True

        # 验证序列化
        dumped = cu.model_dump()
        assert isinstance(dumped["config"], bytes)

        # 验证序列化内容
        decoded = dumped["config"].decode("utf-8")
        parsed = json.loads(decoded)
        assert parsed == {"name": "default", "enabled": True}

    def test_field_serializer_validation_error(self):
        """测试验证错误"""

        class StrictModel(BaseModel):
            required_field: str
            number_field: int

        class TestCU(BaseModel):
            data: BaseModelJson[StrictModel]

            @field_serializer("data")
            def serialize_data(self, value) -> bytes:
                return json_to_bytes_serializer(value)

        # 测试无效 JSON
        with pytest.raises(ValidationError):
            TestCU(data='{"invalid": json}')

        # 测试缺少必填字段
        with pytest.raises(ValidationError):
            TestCU(data='{"number_field": 123}')  # 缺少 required_field

        # 测试类型错误
        with pytest.raises(ValidationError):
            TestCU(data='{"required_field": "ok", "number_field": "not_a_number"}')


class TestRealWorldUsage:
    """真实世界使用场景测试"""

    def test_message_like_structure(self):
        """测试类似消息的数据结构"""

        class LinkContent(BaseModel):
            title: str
            url: str
            desc: str | None = None

        class SendContentItem(BaseModel):
            type: str
            link: LinkContent | None = None

        class MessageData(BaseModel):
            text_content: str = ""
            attachments: list[SendContentItem] = []

        class MessageCU(BaseModel):
            data_json: BaseModelJson[MessageData] = MessageData()

            @field_serializer("data_json")
            def serialize_data_json(self, value) -> bytes:
                return json_to_bytes_serializer(value)

        # 测试复杂的嵌套结构
        test_content = {
            "text_content": "这是测试消息",
            "attachments": [{"type": "link", "link": {"title": "测试链接", "url": "https://example.com", "desc": "这是一个测试链接"}}],
        }

        json_str = json.dumps(test_content, ensure_ascii=False)
        msg_cu = MessageCU(data_json=json_str)

        # 验证解析正确
        assert msg_cu.data_json.text_content == "这是测试消息"
        assert len(msg_cu.data_json.attachments) == 1
        assert msg_cu.data_json.attachments[0].type == "link"
        assert msg_cu.data_json.attachments[0].link
        assert msg_cu.data_json.attachments[0].link.title == "测试链接"

        # 验证序列化
        dumped = msg_cu.model_dump()
        assert isinstance(dumped["data_json"], bytes)

        # 验证序列化内容
        decoded = dumped["data_json"].decode("utf-8")
        parsed = json.loads(decoded)
        assert parsed == test_content

    def test_multiple_json_fields(self):
        """测试多个 JSON 字段"""

        class ConfigModel(BaseModel):
            debug: bool = False
            timeout: int = 30

        class MetaModel(BaseModel):
            version: str
            author: str

        class MultiFieldCU(BaseModel):
            config_: BaseModelJson[ConfigModel] = ConfigModel()
            metadata: BaseModelJson[MetaModel]
            name: str

            @field_serializer("config_")
            def serialize_config(self, value) -> bytes:
                return json_to_bytes_serializer(value)

            @field_serializer("metadata")
            def serialize_metadata(self, value) -> bytes:
                return json_to_bytes_serializer(value)

        cu = MultiFieldCU(config_='{"debug": true, "timeout": 60}', metadata='{"version": "1.0", "author": "test"}', name="test_model")

        # 验证解析
        assert cu.config_.debug is True
        assert cu.config_.timeout == 60
        assert cu.metadata.version == "1.0"
        assert cu.metadata.author == "test"
        assert cu.name == "test_model"

        # 验证序列化
        dumped = cu.model_dump()
        assert isinstance(dumped["config_"], bytes)
        assert isinstance(dumped["metadata"], bytes)
        assert isinstance(dumped["name"], str)


class TestPerformance:
    """性能相关测试"""

    def test_pydantic_model_path_optimization(self):
        """测试 Pydantic 模型的优化路径"""

        class OptimizedModel(BaseModel):
            data: dict[str, Any]
            count: int

        model = OptimizedModel(data={"key": "value"}, count=42)
        result = json_to_bytes_serializer(model)

        # 验证使用了 model_dump_json 路径
        # 这个路径应该更高效
        assert isinstance(result, bytes)

        decoded = result.decode("utf-8")
        parsed = json.loads(decoded)
        assert parsed == {"data": {"key": "value"}, "count": 42}


if __name__ == "__main__":
    pytest.main([__file__])
