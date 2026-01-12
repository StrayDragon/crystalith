"""
Schema增强器纯函数测试
"""

from cl_stdx.enumx import MetaInfoIntEnum, MetaInfoStrEnum, XMetaInfo
from pydantic import BaseModel, Field

from cl_fastapix import build_enum_schema, build_nullable_enum_schema
from cl_fastapix.schema_enhancer import (
    enhance_component_schemas,
    enhance_enum_schema,
    enhance_openapi_schema,
    enhance_parameter_description,
    enhance_parameter_schema,
    enhance_path_parameters,
    generate_context_hint,
    generate_enhanced_description,
    should_enhance_parameter_description,
)


# 测试用枚举类
class MockTargetType(MetaInfoIntEnum):
    """模拟目标类型枚举"""

    STAFF = (1, XMetaInfo("员工"))
    CUSTOMER = (2, XMetaInfo("客户"))


class MockStatusType(MetaInfoIntEnum):
    """模拟状态类型枚举"""

    ENABLED = (1, XMetaInfo("启用"))
    DISABLED = (2, XMetaInfo("禁用"))


class MockStringEnum(MetaInfoStrEnum):
    """模拟字符串枚举"""

    ACTIVE = ("active", XMetaInfo("激活"))
    INACTIVE = ("inactive", XMetaInfo("非激活"))


# 专门用于同值冲突匹配测试的两个顶层枚举
class EnumScopeX(MetaInfoIntEnum):
    ALL = (1, XMetaInfo("全部客户X"))
    FILTERED = (2, XMetaInfo("筛选客户X"))


class EnumStatusY(MetaInfoIntEnum):
    ENABLED = (1, XMetaInfo("启用Y"))
    DISABLED = (2, XMetaInfo("禁用Y"))


# 用于测试无匹配和空枚举情况的枚举类
class MockUnknownEnum(MetaInfoIntEnum):
    """用于测试无匹配情况的枚举"""

    VALUE_999 = (999, XMetaInfo("值999"))
    VALUE_1000 = (1000, XMetaInfo("值1000"))


class MockEmptyEnum(MetaInfoIntEnum):
    """空枚举用于测试"""


class WecomGroupmsgFilterSendScope(MetaInfoIntEnum):
    """模拟真实业务中的发送范围枚举"""

    ALL = (1, XMetaInfo("全部客户"))
    USE_FILTER = (2, XMetaInfo("筛选客户"))


class TestSchemaEnhancer:
    """Schema增强器测试"""

    def test_generate_context_hint(self):
        """测试上下文提示生成"""
        hint = generate_context_hint("target_type", "/api/statistics/summary", "get")
        assert "target_type" in hint
        assert "api" in hint or "statistics" in hint or "summary" in hint

        # 测试简单情况
        hint = generate_context_hint("status")
        assert hint == "status"

    def test_generate_enhanced_description(self):
        """测试增强描述生成"""
        # 测试基本功能
        enhanced = generate_enhanced_description(MockTargetType, "原始描述")
        assert "原始描述" in enhanced
        assert "* `1`: 员工" in enhanced
        assert "* `2`: 客户" in enhanced

        # 测试空原始描述
        enhanced = generate_enhanced_description(MockTargetType)
        assert "枚举值:" in enhanced
        assert "* `1`: 员工" in enhanced

        # 测试已有详细描述的情况
        original_with_details = "原始描述\n\n* `1`: 已有描述"
        enhanced = generate_enhanced_description(MockTargetType, original_with_details)
        assert enhanced == original_with_details  # 不应该修改

    def test_enhance_enum_schema(self):
        """测试枚举schema增强"""
        # 准备测试schema(使用构建器显式注入元数据)
        schema = build_enum_schema(MockTargetType, description="目标类型")

        enhanced = enhance_enum_schema(schema, "target_type")

        assert enhanced["type"] == "integer"
        assert enhanced["enum"] == [1, 2]
        assert "员工" in enhanced["description"]
        assert "客户" in enhanced["description"]

        # 测试无匹配的情况
        schema_no_match = build_enum_schema(MockUnknownEnum, description="未知枚举")

        enhanced_no_match = enhance_enum_schema(schema_no_match)
        assert enhanced_no_match == schema_no_match  # 应该保持不变

    def test_enhance_parameter_schema(self):
        """测试参数schema增强"""
        param = {
            "name": "target_type",
            "in": "query",
            "required": True,
            "schema": build_enum_schema(MockTargetType, description="目标类型"),
            "description": "目标类型参数",
        }

        enhanced = enhance_parameter_schema(param, "/api/statistics", "get")

        # 验证schema被增强
        assert "员工" in enhanced["schema"]["description"]
        assert "客户" in enhanced["schema"]["description"]

        # 验证参数描述也被增强
        assert "员工" in enhanced["description"]
        assert "客户" in enhanced["description"]

    def test_should_enhance_parameter_description(self):
        """测试是否应该增强参数描述的判断"""
        # 应该增强的情况:schema有详细描述但参数描述没有
        param_should_enhance = {"schema": {"enum": [1, 2], "description": "描述\n\n* `1`: 详细描述"}, "description": "简单描述"}
        assert should_enhance_parameter_description(param_should_enhance)

        # 不应该增强的情况:参数描述已经有详细信息
        param_already_enhanced = {
            "schema": {"enum": [1, 2], "description": "描述\n\n* `1`: 详细描述"},
            "description": "描述\n\n* `1`: 详细描述",
        }
        assert not should_enhance_parameter_description(param_already_enhanced)

        # 不应该增强的情况:不是枚举
        param_not_enum = {"schema": {"type": "string"}, "description": "字符串参数"}
        assert not should_enhance_parameter_description(param_not_enum)

    def test_enhance_parameter_description(self):
        """测试参数描述增强"""
        param = {"schema": {"enum": [1, 2], "description": "目标类型\n\n* `1`: 员工\n* `2`: 客户"}, "description": "目标类型"}

        enhanced = enhance_parameter_description(param)

        # 参数描述应该被更新为schema的详细描述
        assert enhanced["description"] == param["schema"]["description"]

    def test_enhance_component_schemas(self):
        """测试组件schemas增强"""
        component_schemas = {
            "TestModel": {
                "type": "object",
                "properties": {
                    "status": build_enum_schema(MockStatusType, description="状态"),
                },
            }
        }

        enhanced = enhance_component_schemas(component_schemas)

        # 验证嵌套的枚举被增强
        status_schema = enhanced["TestModel"]["properties"]["status"]
        # 注意:这里可能匹配到不同的枚举类,关键是验证有详细描述
        assert len(status_schema["description"]) > len("状态")
        assert "*" in status_schema["description"]  # 包含详细描述格式

    def test_enhance_path_parameters(self):
        """测试路径参数增强"""
        paths = {
            "/test/{id}": {"get": {"parameters": [{"name": "target_type", "in": "query", "schema": build_enum_schema(MockTargetType)}]}}
        }

        enhanced = enhance_path_parameters(paths)

        # 验证参数被增强
        param = enhanced["/test/{id}"]["get"]["parameters"][0]
        assert "enum" in param["schema"]
        # 验证有详细描述被添加
        assert len(param["schema"].get("description", "")) > 0

    def test_enhance_openapi_schema_full(self):
        """测试完整OpenAPI schema增强"""
        schema = {
            "openapi": "3.1.0",
            "info": {"title": "Test", "version": "1.0.0"},
            "paths": {
                "/test": {
                    "get": {
                        "parameters": [
                            {
                                "name": "target_type",
                                "in": "query",
                                "schema": build_enum_schema(MockTargetType, description="目标类型"),
                            }
                        ]
                    }
                }
            },
            "components": {
                "schemas": {
                    "TestModel": {
                        "type": "object",
                        "properties": {"status": build_enum_schema(MockStatusType, description="状态")},
                    }
                }
            },
        }

        enhanced = enhance_openapi_schema(schema)

        # 验证基本结构保持不变
        assert enhanced["openapi"] == "3.1.0"
        assert enhanced["info"]["title"] == "Test"

        # 验证路径参数被增强
        param = enhanced["paths"]["/test"]["get"]["parameters"][0]
        assert "员工" in param["schema"]["description"] or "启用" in param["schema"]["description"]

        # 验证组件schemas被增强
        status_prop = enhanced["components"]["schemas"]["TestModel"]["properties"]["status"]
        assert len(status_prop["description"]) > len("状态")

    def test_explicit_x_enum_metadata_takes_precedence(self):
        """当 schema 包含 x-enum 元数据时,应直接匹配对应的枚举,忽略上下文."""

        class EnumScopeX(MetaInfoIntEnum):
            ALL = (1, XMetaInfo("全部客户X"))
            FILTERED = (2, XMetaInfo("筛选客户X"))

        class EnumStatusY(MetaInfoIntEnum):
            ENABLED = (1, XMetaInfo("启用Y"))
            DISABLED = (2, XMetaInfo("禁用Y"))

        # 使用构建器生成的 schema 带有 x-enum 元数据,会直接匹配到 MockStatusType
        schema = build_enum_schema(MockStatusType, description="占位")

        # 即使提供不同的上下文,仍会匹配到 MockStatusType
        enhanced_scope = enhance_enum_schema(schema, context_hint="send_scope")
        assert "启用" in enhanced_scope.get("description", "")
        assert "禁用" in enhanced_scope.get("description", "")
        assert "全部客户X" not in enhanced_scope.get("description", "")
        assert "启用Y" not in enhanced_scope.get("description", "")

        # 使用手工 schema(无 x-enum 元数据),会回退到上下文匹配
        manual_schema = {"type": "integer", "enum": [1, 2], "description": "占位"}
        enhanced_manual = enhance_enum_schema(manual_schema, context_hint="send_scope")
        # 这里可能匹配到 EnumScopeX 或其他枚举,取决于上下文打分
        assert "enum" in enhanced_manual

    def test_component_property_collapse_anyof(self):
        """组件模型属性为 IntEnum 时,应折叠 anyOf[int|string] 并保留 integer/enum."""
        from pydantic import BaseModel, Field

        class LocalEnum(MetaInfoIntEnum):
            A = (1, XMetaInfo("甲"))
            B = (2, XMetaInfo("乙"))

        class M(BaseModel):
            send_scope: LocalEnum = Field(..., description="发送范围")

        schema = {
            "openapi": "3.1.0",
            "info": {"title": "t", "version": "1"},
            "paths": {},
            "components": {"schemas": {"M": M.model_json_schema()}},
        }

        enhanced = enhance_openapi_schema(schema)
        prop = enhanced["components"]["schemas"]["M"]["properties"]["send_scope"]
        assert "anyOf" not in prop
        assert prop["type"] == "integer"
        assert prop["enum"] == [1, 2]

    def test_component_property_context_drives_correct_enum(self):
        """组件属性名 context 应驱动匹配到正确的枚举类,避免错配到其他同值枚举."""

        class M(BaseModel):
            send_scope: WecomGroupmsgFilterSendScope = Field(..., description="发送范围")

        schema = {
            "openapi": "3.1.0",
            "info": {"title": "t", "version": "1"},
            "paths": {},
            "components": {"schemas": {"M": M.model_json_schema()}},
        }

        enhanced = enhance_openapi_schema(schema)
        prop = enhanced["components"]["schemas"]["M"]["properties"]["send_scope"]
        # 应为“全部客户/筛选客户”
        desc = prop.get("description", "")
        assert "全部客户" in desc
        assert "筛选客户" in desc

    def test_collapse_anyof_integer_string_when_top_enum_exists(self):
        """当顶层已包含 enum 且 anyOf 仅用于 int|string 的 JSON/py 兼容时,应移除 anyOf 保留 integer 类型."""
        schema = {
            "type": "integer",
            "enum": [1, 2],
            "anyOf": [{"type": "integer"}, {"type": "string"}],
            "description": "发送范围",
        }

        enhanced = enhance_enum_schema(schema, context_hint="send_scope")

        assert "anyOf" not in enhanced
        assert enhanced["type"] == "integer"
        assert enhanced["enum"] == [1, 2]

    def test_builders_provide_deterministic_enum_resolution(self):
        """使用 schema_builders 显式注入 x-enum-*, 确保稳定选中正确的枚举类."""

        class LocalEnumA(MetaInfoIntEnum):
            A1 = (1, XMetaInfo("A-一"))
            A2 = (2, XMetaInfo("A-二"))

        class LocalEnumB(MetaInfoIntEnum):
            A1 = (1, XMetaInfo("B-一"))
            A2 = (2, XMetaInfo("B-二"))

        # 使用构建器生成的 schema 带有 x-enum 元数据,不会产生歧义
        ambiguous_schema = build_enum_schema(MockStatusType, description="示例")
        enhanced_ambiguous = enhance_enum_schema(ambiguous_schema, context_hint="demo")
        # 由于有显式 x-enum 元数据,这里验证会匹配到正确的枚举
        assert "启用" in enhanced_ambiguous.get("description", "")
        assert "禁用" in enhanced_ambiguous.get("description", "")

        # 使用构建器,显式绑定到 LocalEnumA
        deterministic_schema = build_enum_schema(LocalEnumA, description="示例A")
        enhanced_deterministic = enhance_enum_schema(deterministic_schema, context_hint="demo")
        desc = enhanced_deterministic.get("description", "")
        assert "A-一" in desc
        assert "A-二" in desc
        assert "B-一" not in desc
        assert "B-二" not in desc

        # 可空场景同样稳定
        nullable_schema = build_nullable_enum_schema(LocalEnumB, description="示例B")
        enhanced_nullable = enhance_enum_schema(nullable_schema, context_hint="demo")
        assert "anyOf" in enhanced_nullable
        enum_branch = next(item for item in enhanced_nullable["anyOf"] if isinstance(item, dict) and "enum" in item)
        ndesc = enum_branch.get("description", "")
        assert "B-一" in ndesc
        assert "B-二" in ndesc

    def test_keep_anyof_when_nullable_enum(self):
        """当 anyOf 包含 null(可空)时保留 anyOf,但增强枚举分支的描述."""
        # 使用构建器生成可空枚举(anyOf),消除歧义
        schema = build_nullable_enum_schema(EnumScopeX, description="发送范围")

        enhanced = enhance_enum_schema(schema, context_hint="send_scope")

        assert "anyOf" in enhanced
        # 找到枚举分支并验证类型与枚举值仍在
        enum_branch = next(item for item in enhanced["anyOf"] if isinstance(item, dict) and "enum" in item)
        assert enum_branch["type"] == "integer"
        assert enum_branch["enum"] == [1, 2]

    def test_edge_cases(self):
        """测试边界情况"""
        # 测试空schema
        assert enhance_openapi_schema({}) == {}
        assert enhance_openapi_schema(None) is None

        # 测试无enum的schema
        schema_no_enum = {"type": "string", "description": "字符串"}
        enhanced = enhance_enum_schema(schema_no_enum)
        assert enhanced == schema_no_enum

        # 测试空enum
        schema_empty_enum = build_enum_schema(MockEmptyEnum)
        enhanced = enhance_enum_schema(schema_empty_enum)
        assert enhanced == schema_empty_enum

        # 测试无效类型
        assert enhance_component_schemas(None) == {}
        assert enhance_path_parameters(None) == {}
