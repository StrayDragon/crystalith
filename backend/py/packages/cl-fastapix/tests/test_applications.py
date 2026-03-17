"""
FastAPIX应用测试
"""

import pytest
from cl_fastapix import FastAPIX
from cl_stdx.enumx import MetaInfoIntEnum, MetaInfoStrEnum, XMetaInfo
from fastapi import Body, Cookie, Header, Path, Query
from pydantic import BaseModel


# 测试用枚举类
class MockIntEnum(MetaInfoIntEnum):
    """测试整型枚举"""

    OPTION_A = (1, XMetaInfo("选项A"))
    OPTION_B = (2, XMetaInfo("选项B"))


class MockStrEnum(MetaInfoStrEnum):
    """测试字符串枚举"""

    STATUS_ACTIVE = ("active", XMetaInfo("激活状态"))
    STATUS_INACTIVE = ("inactive", XMetaInfo("非激活状态"))


class MockRequestBody(BaseModel):
    """测试请求体"""

    enum_field: MockIntEnum
    str_enum_field: MockStrEnum


class ConflictingEnum(MetaInfoIntEnum):
    """与TestIntEnum值相同但描述不同的枚举"""

    ENABLED = (1, XMetaInfo("启用"))
    DISABLED = (2, XMetaInfo("禁用"))


@pytest.fixture
def test_app():
    """创建测试应用"""
    app = FastAPIX(title="Test App", version="1.0.0")

    @app.get("/test/query")
    def test_query_param(enum_param: MockIntEnum = Query(..., description="查询参数枚举")):
        return {"type": "query", "value": enum_param}

    @app.get("/test/path/{enum_param}")
    def test_path_param(enum_param: MockIntEnum = Path(..., description="路径参数枚举")):
        return {"type": "path", "value": enum_param}

    @app.get("/test/header")
    def test_header_param(x_enum_header: MockStrEnum = Header(..., description="头部参数枚举")):
        return {"type": "header", "value": x_enum_header}

    @app.get("/test/cookie")
    def test_cookie_param(enum_cookie: MockStrEnum = Cookie(..., description="Cookie参数枚举")):
        return {"type": "cookie", "value": enum_cookie}

    @app.post("/test/body")
    def test_body_param(request_body: MockRequestBody = Body(..., description="请求体枚举")):
        return {"type": "body", "value": request_body}

    @app.get("/test/conflicting")
    def test_conflicting_enum(conflicting_param: ConflictingEnum = Query(..., description="冲突枚举参数")):
        return {"type": "conflicting", "value": conflicting_param}

    @app.get("/test/optional")
    def test_optional_enum(
        required_enum: MockIntEnum = Query(..., description="必需枚举"),
        optional_enum: MockIntEnum | None = Query(None, description="可选枚举"),
        union_enum: MockIntEnum | None = Query(None, description="Union枚举"),
        modern_optional: MockIntEnum | None = Query(None, description="现代可选枚举"),
    ):
        return {
            "required_enum": required_enum,
            "optional_enum": optional_enum,
            "union_enum": union_enum,
            "modern_optional": modern_optional,
        }

    return app


class TestFastAPIX:
    """FastAPIX功能测试"""

    def test_query_parameter_enhancement(self, test_app):
        """测试Query参数的枚举增强"""
        schema = test_app.openapi()

        # 查找Query参数
        test_path = schema["paths"]["/test/query"]["get"]
        target_param = None
        for param in test_path["parameters"]:
            if param["name"] == "enum_param":
                target_param = param
                break

        assert target_param is not None
        param_description = target_param["description"]

        # 验证包含详细枚举描述(格式检查,兼容不同的枚举类型)
        has_detailed_format = "* `1`:" in param_description and "* `2`:" in param_description
        assert has_detailed_format, "应该包含详细的枚举描述格式"

    def test_path_parameter_enhancement(self, test_app):
        """测试Path参数的枚举增强"""
        schema = test_app.openapi()

        test_path = schema["paths"]["/test/path/{enum_param}"]["get"]
        target_param = None
        for param in test_path["parameters"]:
            if param["name"] == "enum_param":
                target_param = param
                break

        assert target_param is not None
        param_description = target_param["description"]

        # 验证包含详细枚举描述(格式检查,兼容不同的枚举类型)
        has_detailed_format = "* `1`:" in param_description and "* `2`:" in param_description
        assert has_detailed_format, "应该包含详细的枚举描述格式"

    def test_header_parameter_enhancement(self, test_app):
        """测试Header参数的枚举增强"""
        schema = test_app.openapi()

        test_path = schema["paths"]["/test/header"]["get"]
        target_param = None
        for param in test_path["parameters"]:
            if param["name"] == "x-enum-header":
                target_param = param
                break

        assert target_param is not None
        param_description = target_param["description"]

        assert "激活状态" in param_description
        assert "非激活状态" in param_description

    def test_cookie_parameter_enhancement(self, test_app):
        """测试Cookie参数的枚举增强"""
        schema = test_app.openapi()

        test_path = schema["paths"]["/test/cookie"]["get"]
        target_param = None
        for param in test_path["parameters"]:
            if param["name"] == "enum_cookie":
                target_param = param
                break

        assert target_param is not None
        param_description = target_param["description"]

        assert "激活状态" in param_description
        assert "非激活状态" in param_description

    def test_body_parameter_enhancement(self, test_app):
        """测试Body参数的枚举增强"""
        schema = test_app.openapi()

        # 检查components中的schema
        components = schema.get("components", {})
        schemas = components.get("schemas", {})

        # 查找MockRequestBody schema
        test_request_body_schema = schemas.get("MockRequestBody", {})
        assert test_request_body_schema

        properties = test_request_body_schema.get("properties", {})

        # 验证enum_field
        enum_field_schema = properties.get("enum_field", {})
        assert enum_field_schema
        description = enum_field_schema.get("description", "")
        assert "选项A" in description
        assert "选项B" in description

        # 验证str_enum_field
        str_enum_field_schema = properties.get("str_enum_field", {})
        assert str_enum_field_schema
        str_description = str_enum_field_schema.get("description", "")
        assert "激活状态" in str_description
        assert "非激活状态" in str_description

    def test_conflicting_enum_resolution(self, test_app):
        """测试冲突枚举的正确解析"""
        schema = test_app.openapi()

        test_path = schema["paths"]["/test/conflicting"]["get"]
        target_param = None
        for param in test_path["parameters"]:
            if param["name"] == "conflicting_param":
                target_param = param
                break

        assert target_param is not None
        param_description = target_param["description"]

        # 应该匹配到ConflictingEnum而不是TestIntEnum
        assert "启用" in param_description
        assert "禁用" in param_description
        # 不应该包含MockIntEnum的描述
        assert "选项A" not in param_description
        assert "选项B" not in param_description

    def test_schema_structure_integrity(self, test_app):
        """测试schema结构完整性"""
        schema = test_app.openapi()

        # 验证基本结构
        assert "openapi" in schema
        assert "info" in schema
        assert "paths" in schema

        # 验证所有测试路径都存在
        expected_paths = [
            "/test/query",
            "/test/path/{enum_param}",
            "/test/header",
            "/test/cookie",
            "/test/body",
            "/test/conflicting",
            "/test/optional",
        ]

        for path in expected_paths:
            assert path in schema["paths"]

    def test_enum_values_unchanged(self, test_app):
        """确保枚举值没有被修改"""
        schema = test_app.openapi()

        # 检查Query参数的枚举值
        test_path = schema["paths"]["/test/query"]["get"]
        target_param = None
        for param in test_path["parameters"]:
            if param["name"] == "enum_param":
                target_param = param
                break

        assert target_param is not None
        enum_values = target_param["schema"]["enum"]
        assert enum_values == [1, 2]

        # 检查字符串枚举值
        test_path = schema["paths"]["/test/header"]["get"]
        target_param = None
        for param in test_path["parameters"]:
            if param["name"] == "x-enum-header":
                target_param = param
                break

        assert target_param is not None
        enum_values = target_param["schema"]["enum"]
        assert enum_values == ["active", "inactive"]

    def test_optional_enum_enhancement(self, test_app):
        """测试Optional枚举参数的增强"""
        schema = test_app.openapi()

        test_path = schema["paths"]["/test/optional"]["get"]
        parameters = test_path["parameters"]

        # 测试各种Optional枚举类型
        expected_params = {
            "required_enum": True,  # 必需的枚举
            "optional_enum": True,  # Optional[Enum]
            "union_enum": True,  # Union[Enum, None]
            "modern_optional": True,  # Enum | None
        }

        for param in parameters:
            param_name = param["name"]
            param_description = param.get("description", "")

            if param_name in expected_params:
                # 验证参数描述包含详细枚举描述(格式检查)
                has_detailed_format = "* `1`:" in param_description and "* `2`:" in param_description

                assert has_detailed_format, f"{param_name} 应该包含详细的枚举描述格式"

                # 验证至少包含一些枚举值描述
                has_enum_descriptions = (
                    ("选项A" in param_description and "选项B" in param_description)
                    or ("启用" in param_description and "禁用" in param_description)
                    or ("激活状态" in param_description and "非激活状态" in param_description)
                    or ("值1" in param_description and "值2" in param_description)
                )

                assert has_enum_descriptions, f"{param_name} 应该包含具体的枚举值描述.实际描述: {param_description}"

    def test_auto_injects_x_enum_metadata_for_params_and_components(self, test_app):
        """FastAPIX + enumx 生成的 OpenAPI 应自动包含 x-enum 元数据."""
        schema = test_app.openapi()

        # 参数: /test/query -> enum_param
        test_path = schema["paths"]["/test/query"]["get"]
        param = next(p for p in test_path["parameters"] if p["name"] == "enum_param")
        ps = param["schema"]
        assert "x-enum-module" in ps
        assert "x-enum-class" in ps

        # Header 字符串枚举
        test_path = schema["paths"]["/test/header"]["get"]
        header_param = next(p for p in test_path["parameters"] if p["name"] == "x-enum-header")
        hs = header_param["schema"]
        assert "x-enum-module" in hs
        assert "x-enum-class" in hs

        # 组件: MockRequestBody 的 enum_field/str_enum_field
        components = schema.get("components", {})
        schemas = components.get("schemas", {})
        test_request_body_schema = schemas.get("MockRequestBody", {})
        props = test_request_body_schema.get("properties", {})
        enum_field_schema = props.get("enum_field", {})
        str_enum_field_schema = props.get("str_enum_field", {})
        assert "x-enum-module" in enum_field_schema
        assert "x-enum-class" in enum_field_schema
        assert "x-enum-module" in str_enum_field_schema
        assert "x-enum-class" in str_enum_field_schema
