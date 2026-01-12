import enum
import json

import pytest
from pydantic import BaseModel, Json, ValidationError

from cl_stdx.enumx import EnumField, MetaInfoIntEnum, MetaInfoStrEnum, XMetaInfo


class Status(MetaInfoIntEnum):
    """An example IntEnum for testing."""

    PENDING = 1, XMetaInfo("The task is waiting to be processed.")
    RUNNING = 2, XMetaInfo("The task is currently running.")
    SUCCESS = 3, XMetaInfo("The task completed successfully.")
    FAILED = 4, XMetaInfo("The task failed.")


class Flavor(MetaInfoStrEnum):
    """An example StrEnum for testing."""

    VANILLA = "vanilla", XMetaInfo("Classic vanilla flavor.")
    CHOCOLATE = "chocolate", XMetaInfo("Rich chocolate flavor.")
    STRAWBERRY = "strawberry", XMetaInfo("Sweet strawberry flavor.")


class StdStatus(enum.IntEnum):
    PENDING = 1
    RUNNING = 2
    SUCCESS = 3
    FAILED = 4


class StdFlavor(str, enum.Enum):
    """Standard library StrEnum counterpart used for comparisons."""

    VANILLA = "vanilla"
    CHOCOLATE = "chocolate"
    STRAWBERRY = "strawberry"


class PydanticIntEnumModel(BaseModel):
    status: Status


class PydanticStrEnumModel(BaseModel):
    flavor: Flavor


class PlainClassWithEnums:
    status = EnumField(Status)
    flavor = EnumField(Flavor)


class TestMetaInfoIntEnum:
    """Tests for the MetaInfoIntEnum class."""

    def test_member_properties(self):
        """Test basic properties of enum members."""
        assert Status.PENDING == 1
        assert isinstance(Status.RUNNING, int)
        assert isinstance(Status.SUCCESS, Status)
        assert Status.FAILED.x_meta.description == "The task failed."
        assert Status.PENDING.name == "PENDING"
        assert Status.RUNNING.value == 2

    def test_instantiation(self):
        """Test creating members from values and names."""
        assert Status(1) is Status.PENDING
        assert Status["RUNNING"] is Status.RUNNING

    def test_iteration(self):
        """Test that the enum is iterable."""
        members = list(Status)
        assert members == [Status.PENDING, Status.RUNNING, Status.SUCCESS, Status.FAILED]

    def test_pydantic_validation_success(self):
        """Test successful validation in a Pydantic model."""
        # By integer value
        model1 = PydanticIntEnumModel(status=1)
        assert model1.status is Status.PENDING

        # By member itself
        model3 = PydanticIntEnumModel(status=Status.SUCCESS)
        assert model3.status is Status.SUCCESS

    def test_pydantic_validation_with_numeric_strings(self):
        """Test successful validation with numeric strings."""
        # By numeric string (should convert to int then to enum)
        model1 = PydanticIntEnumModel(status="1")
        assert model1.status is Status.PENDING

        model2 = PydanticIntEnumModel(status="2")
        assert model2.status is Status.RUNNING

        model3 = PydanticIntEnumModel(status="3")
        assert model3.status is Status.SUCCESS

        model4 = PydanticIntEnumModel(status="4")
        assert model4.status is Status.FAILED

    def test_pydantic_validation_failure(self):
        """Test failing validation in a Pydantic model."""
        # Invalid integer
        with pytest.raises(ValidationError) as exc_info:
            _ = PydanticIntEnumModel(status=99)
        assert "'99' is not a valid value for Status" in str(exc_info.value)

        # Invalid string name
        with pytest.raises(ValidationError) as exc_info:
            _ = PydanticIntEnumModel(status="unknown")
        assert "'unknown' is not a valid member of Status" in str(exc_info.value)

        # Invalid type
        with pytest.raises(ValidationError) as exc_info:
            _ = PydanticIntEnumModel(status=3.14)
        assert "'3.14' is not a valid value for Status" in str(exc_info.value)

    def test_pydantic_serialization(self):
        """Test serialization of the enum in a Pydantic model."""
        model = PydanticIntEnumModel(status=Status.SUCCESS)
        assert model.model_dump() == {"status": 3}
        assert model.model_dump_json() == '{"status":3}'

    def test_pydantic_serialization_with_exact_scenario(self):
        """Test serialization exactly like the failing scenario."""
        from pydantic import BaseModel, TypeAdapter

        # Create models that match the failing scenario
        class TestContentType(MetaInfoStrEnum):
            IMAGE = ("image", XMetaInfo("图片"))
            LINK = ("link", XMetaInfo("链接"))
            MINIPROGRAM = ("miniprogram", XMetaInfo("小程序"))

        class TestSendMethodType(MetaInfoIntEnum):
            NOTIFY_STAFF = (1, XMetaInfo("通知员工"))

        class TestAttachment(BaseModel):
            type: TestContentType
            title: str = ""
            url: str = ""

        class TestForm(BaseModel):
            send_method: TestSendMethodType
            attachments: list[TestAttachment]

        class TestResp(BaseModel):
            data: TestForm

        # Create exactly the same structure as failing case
        resp = TestResp(
            data=TestForm(
                send_method=TestSendMethodType.NOTIFY_STAFF,
                attachments=[
                    TestAttachment(type=TestContentType.IMAGE, title="", url=""),
                    TestAttachment(type=TestContentType.LINK, title="", url=""),
                    TestAttachment(type=TestContentType.MINIPROGRAM, title="", url=""),
                ],
            )
        )

        # This should work without crashing
        adapter = TypeAdapter(TestResp)
        result = adapter.dump_python(resp, mode="json", by_alias=True)

        # Verify the structure
        assert result["data"]["send_method"] == 1
        assert result["data"]["attachments"][0]["type"] == "image"
        assert result["data"]["attachments"][1]["type"] == "link"
        assert result["data"]["attachments"][2]["type"] == "miniprogram"

    def test_pydantic_json_schema(self):
        """Test the generated JSON schema for the Pydantic model."""
        schema = PydanticIntEnumModel.model_json_schema()
        status_schema = schema["properties"]["status"]

        assert status_schema["enum"] == [1, 2, 3, 4]
        assert "枚举值:" in status_schema["description"]
        assert "* `1`: The task is waiting to be processed." in status_schema["description"]
        assert "* `4`: The task failed." in status_schema["description"]
        # The title is derived from the enum class name
        assert status_schema["title"] == "Status"

    def test_json_field_validation(self):
        """MetaInfoIntEnum should parse Json fields into enum members."""

        class JsonModel(BaseModel):
            statuses: Json[list[Status]]

        model = JsonModel.model_validate({"statuses": json.dumps([1, "2"])})
        assert model.statuses == [Status.PENDING, Status.RUNNING]
        assert all(isinstance(item, Status) for item in model.statuses)

        with pytest.raises(ValidationError) as exc_info:
            _ = JsonModel.model_validate({"statuses": json.dumps(["unknown"])})
        assert "'unknown' is not a valid member of Status" in str(exc_info.value)

    def test_json_field_matches_std_int_enum_behavior(self):
        """MetaInfoIntEnum should mirror stdlib IntEnum behavior under Json parsing."""

        class StdJsonModel(BaseModel):
            statuses: Json[list[StdStatus]]

        class MetaJsonModel(BaseModel):
            statuses: Json[list[Status]]

        payload = {"statuses": json.dumps([1, "2", 3])}
        std_model = StdJsonModel.model_validate(payload)
        meta_model = MetaJsonModel.model_validate(payload)

        assert [int(item) for item in std_model.statuses] == [int(item) for item in meta_model.statuses]

        with pytest.raises(ValidationError):
            _ = StdJsonModel.model_validate({"statuses": json.dumps(["unknown"])})
        with pytest.raises(ValidationError):
            _ = MetaJsonModel.model_validate({"statuses": json.dumps(["unknown"])})


# --- Tests for MetaInfoStrEnum ---


class TestMetaInfoStrEnum:
    """Tests for the MetaInfoStrEnum class."""

    def test_member_properties(self):
        """Test basic properties of enum members."""
        assert Flavor.VANILLA == "vanilla"
        assert isinstance(Flavor.CHOCOLATE, str)
        assert isinstance(Flavor.STRAWBERRY, Flavor)
        assert Flavor.VANILLA.x_meta.description == "Classic vanilla flavor."
        assert Flavor.CHOCOLATE.name == "CHOCOLATE"
        assert Flavor.STRAWBERRY.value == "strawberry"

    def test_instantiation(self):
        """Test creating members from values and names."""
        assert Flavor("vanilla") is Flavor.VANILLA
        assert Flavor["CHOCOLATE"] is Flavor.CHOCOLATE

    def test_iteration(self):
        """Test that the enum is iterable."""
        members = list(Flavor)
        assert members == [Flavor.VANILLA, Flavor.CHOCOLATE, Flavor.STRAWBERRY]

    def test_pydantic_validation_success(self):
        """Test successful validation in a Pydantic model."""
        # By string value
        model1 = PydanticStrEnumModel(flavor="vanilla")
        assert model1.flavor is Flavor.VANILLA

        # By member itself
        model3 = PydanticStrEnumModel(flavor=Flavor.STRAWBERRY)
        assert model3.flavor is Flavor.STRAWBERRY

    def test_pydantic_validation_failure(self):
        """Test failing validation in a Pydantic model."""
        # Invalid string
        with pytest.raises(ValidationError) as exc_info:
            _ = PydanticStrEnumModel(flavor="mint")
        assert "'mint' is not a valid value or name for Flavor" in str(exc_info.value)

        # Invalid type
        with pytest.raises(ValidationError) as exc_info:
            _ = PydanticStrEnumModel(flavor=123)
        assert "Input for Flavor must be a string." in str(exc_info.value)

    def test_pydantic_serialization(self):
        """Test serialization of the enum in a Pydantic model."""
        model = PydanticStrEnumModel(flavor=Flavor.CHOCOLATE)
        assert model.model_dump() == {"flavor": "chocolate"}
        assert model.model_dump_json() == '{"flavor":"chocolate"}'

    def test_pydantic_serialization_with_string_value(self):
        """Test serialization handles string values without crashing."""
        from pydantic import TypeAdapter

        # Create a type adapter for Flavor enum
        adapter = TypeAdapter(Flavor)

        # Test that string values are handled gracefully in serialization
        # This shouldn't crash with AttributeError: 'str' object has no attribute 'value'
        result = adapter.dump_python("vanilla")  # This might be a string in some edge cases
        # The serializer should handle this case without crashing
        assert result == "vanilla"  # String values should pass through

    def test_pydantic_json_schema(self):
        """Test the generated JSON schema for the Pydantic model."""
        schema = PydanticStrEnumModel.model_json_schema()
        flavor_schema = schema["properties"]["flavor"]

        assert flavor_schema["enum"] == ["vanilla", "chocolate", "strawberry"]
        assert "枚举值:" in flavor_schema["description"]
        assert "* `vanilla`: Classic vanilla flavor." in flavor_schema["description"]
        assert "* `strawberry`: Sweet strawberry flavor." in flavor_schema["description"]
        assert flavor_schema["title"] == "Flavor"

    def test_json_field_validation(self):
        """MetaInfoStrEnum should parse Json fields into enum members."""

        class JsonModel(BaseModel):
            flavors: Json[list[Flavor]]

        model = JsonModel.model_validate({"flavors": json.dumps(["vanilla", "CHOCOLATE"])})
        assert model.flavors == [Flavor.VANILLA, Flavor.CHOCOLATE]
        assert all(isinstance(item, Flavor) for item in model.flavors)

        with pytest.raises(ValidationError) as exc_info:
            _ = JsonModel.model_validate({"flavors": json.dumps([123])})
        assert "Input for Flavor must be a string." in str(exc_info.value)

    def test_json_field_matches_std_str_enum_behavior(self):
        """MetaInfoStrEnum should mirror stdlib StrEnum behavior under Json parsing."""

        class StdJsonModel(BaseModel):
            flavors: Json[list[StdFlavor]]

        class MetaJsonModel(BaseModel):
            flavors: Json[list[Flavor]]

        payload = {"flavors": json.dumps(["vanilla", "chocolate"])}
        std_model = StdJsonModel.model_validate(payload)
        meta_model = MetaJsonModel.model_validate(payload)

        std_values = [item.value for item in std_model.flavors]
        meta_values = [item.value for item in meta_model.flavors]
        assert std_values == meta_values

        with pytest.raises(ValidationError):
            _ = StdJsonModel.model_validate({"flavors": json.dumps([123])})
        with pytest.raises(ValidationError):
            _ = MetaJsonModel.model_validate({"flavors": json.dumps([123])})


# --- Tests for EnumField Descriptor ---


class TestEnumField:
    """Tests for the EnumField descriptor."""

    def test_init_failure(self):
        """Test that EnumField raises TypeError if not given an enum class."""

        class NotAnEnum:
            pass

        with pytest.raises(TypeError, match="enum_cls must be subclass of enum.Enum"):
            EnumField(NotAnEnum)

    def test_get_on_class(self):
        """Test getting the descriptor from the class itself."""
        assert isinstance(PlainClassWithEnums.status, EnumField)

    def test_set_and_get_value(self):
        """Test setting and getting values on an instance."""
        instance = PlainClassWithEnums()

        # Initial state should be None
        assert instance.status is None
        assert instance.flavor is None

        # Set by member
        instance.status = Status.RUNNING
        assert instance.status is Status.RUNNING

        # Set by value (int)
        instance.status = 1
        assert instance.status is Status.PENDING

        # Set by name (string, case-insensitive)
        instance.status = "success"
        assert instance.status is Status.SUCCESS

        # Set by member
        instance.flavor = Flavor.CHOCOLATE
        assert instance.flavor is Flavor.CHOCOLATE

        # Set by value (string)
        instance.flavor = "strawberry"
        assert instance.flavor is Flavor.STRAWBERRY

        # Set by name (string, case-insensitive)
        instance.flavor = "VANILLA"
        assert instance.flavor is Flavor.VANILLA

        # Set to None
        instance.status = None
        assert instance.status is None

    def test_set_invalid_value(self):
        """Test setting invalid values on the descriptor."""
        instance = PlainClassWithEnums()

        # Invalid int value
        with pytest.raises(ValueError, match="'99' is not a valid member, value or name for Status"):
            instance.status = 99

        # Invalid string name for IntEnum
        with pytest.raises(ValueError, match="'unknown' is not a valid member, value or name for Status"):
            instance.status = "unknown"

        # Invalid type for IntEnum
        with pytest.raises(ValueError, match="'3.14' is not a valid member, value or name for Status"):
            instance.status = 3.14

        # Invalid string for StrEnum
        with pytest.raises(ValueError, match="'mint' is not a valid member, value or name for Flavor"):
            instance.flavor = "mint"

        # Invalid type for StrEnum
        with pytest.raises(ValueError, match="'123' is not a valid member, value or name for Flavor"):
            instance.flavor = 123

    def test_private_name_mangling(self):
        """Test that the private attribute name is correctly set."""
        instance = PlainClassWithEnums()
        instance.status = Status.PENDING
        assert hasattr(instance, "_status")
        assert instance._status is Status.PENDING


# --- Additional boundary tests for coverage ---


class TestMetaInfoIntEnumEdgeCases:
    """Edge case tests for MetaInfoIntEnum coverage."""

    def test_to_db_field_comment_empty(self):
        """Test to_db_field_comment with empty enum (line 32)."""

        # Create an empty enum by directly using the class
        class EmptyIntEnum(MetaInfoIntEnum):
            pass

        # Should return empty string for empty enum
        result = EmptyIntEnum.to_db_field_comment()
        assert result == ""

    def test_iteration_over_empty_int_enum(self):
        """Test that iteration over empty enum returns empty list."""

        class EmptyIntEnum(MetaInfoIntEnum):
            pass

        members = list(EmptyIntEnum)
        assert members == []


class TestMetaInfoStrEnumEdgeCases:
    """Edge case tests for MetaInfoStrEnum coverage."""

    def test_to_db_field_comment_empty(self):
        """Test to_db_field_comment with empty StrEnum (line 99)."""

        class EmptyStrEnum(MetaInfoStrEnum):
            pass

        result = EmptyStrEnum.to_db_field_comment()
        assert result == ""

    def test_iteration_over_empty_str_enum(self):
        """Test that iteration over empty StrEnum returns empty list."""

        class EmptyStrEnum(MetaInfoStrEnum):
            pass

        members = list(EmptyStrEnum)
        assert members == []


class TestEnumFieldEdgeCases:
    """Edge case tests for EnumField descriptor coverage."""

    def test_get_before_set_name(self):
        """Test __get__ when private_name is None (line 170)."""
        # Create EnumField directly without going through __set_name__
        field = EnumField(Status)

        # Accessing from class should return the field itself
        assert field.enum_cls is Status

    def test_instance_get_before_set_name_returns_none(self):
        """Test instance access returns None when __set_name__ was never called."""
        field = EnumField(Status)

        class Dummy:
            pass

        Dummy.status = field
        instance = Dummy()

        assert instance.status is None

    def test_descriptor_with_custom_name(self):
        """Test descriptor with a custom name setup."""
        field = EnumField(Status)

        # Simulate __set_name__ being called
        field.__set_name__(None, "custom_status")

        # Now private_name should be set
        assert field.private_name == "_custom_status"

    def test_set_none_after_value_set(self):
        """Test setting None after a value has been set."""
        instance = PlainClassWithEnums()

        # Set a value first
        instance.status = Status.SUCCESS
        assert instance.status is Status.SUCCESS

        # Set to None
        instance.status = None
        assert instance.status is None

    def test_get_after_setting_none(self):
        """Test getting value after it was set to None."""
        instance = PlainClassWithEnums()

        instance.status = Status.FAILED
        instance.status = None

        # Getting should return None
        assert instance.status is None
        # Private attribute should be None
        assert getattr(instance, "_status", None) is None


class TestEnumFieldDescriptorEdgeCases:
    """Additional edge case tests for EnumField."""

    def test_accessing_from_class_returns_field(self):
        """Accessing descriptor from class returns the field object."""
        assert PlainClassWithEnums.status is not None
        assert isinstance(PlainClassWithEnums.status, EnumField)

    def test_different_enum_types(self):
        """Test EnumField with different enum types."""

        class Priority(MetaInfoIntEnum):
            LOW = 1, XMetaInfo("Low priority")
            HIGH = 2, XMetaInfo("High priority")

        class TaskStatus(MetaInfoStrEnum):
            TODO = "todo", XMetaInfo("To do")
            DONE = "done", XMetaInfo("Done")

        class MixedClass:
            priority = EnumField(Priority)
            status = EnumField(TaskStatus)

        instance = MixedClass()

        # Set values
        instance.priority = Priority.HIGH
        instance.status = TaskStatus.DONE

        assert instance.priority is Priority.HIGH
        assert instance.status is TaskStatus.DONE

        # Can set by value
        instance.priority = 1
        assert instance.priority is Priority.LOW

        # Can set by name (case insensitive for StrEnum)
        instance.status = "TODO"
        assert instance.status is TaskStatus.TODO
