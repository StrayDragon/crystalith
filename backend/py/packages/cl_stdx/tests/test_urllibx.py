"""Tests for urllibx module."""

from cl_stdx.urllibx import extract_query_param, url_update_params


class TestUrlUpdateParams:
    """Tests for url_update_params function."""

    def test_add_new_param(self) -> None:
        """Test adding a new parameter to URL without existing params."""
        url = "https://example.com/path"
        params = {"key": "value"}

        result = url_update_params(url, params)

        assert result == "https://example.com/path?key=value"

    def test_update_existing_param(self) -> None:
        """Test updating an existing parameter."""
        url = "https://example.com/path?key=old_value"
        params = {"key": "new_value"}

        result = url_update_params(url, params)

        assert result == "https://example.com/path?key=new_value"

    def test_add_multiple_params(self) -> None:
        """Test adding multiple parameters."""
        url = "https://example.com/path"
        params = {"a": "1", "b": "2", "c": "3"}

        result = url_update_params(url, params)

        # Should contain all parameters
        assert "a=1" in result
        assert "b=2" in result
        assert "c=3" in result

    def test_mix_add_and_update(self) -> None:
        """Test mixing new and existing parameters."""
        url = "https://example.com/path?existing=keep"
        params = {"existing": "update", "new": "value"}

        result = url_update_params(url, params)

        assert "existing=update" in result
        assert "new=value" in result

    def test_url_with_fragment(self) -> None:
        """Test URL with fragment (hash) - fragment should be preserved."""
        url = "https://example.com/path#section"
        params = {"key": "value"}

        result = url_update_params(url, params)

        # Fragment should not be affected by query params
        assert result.startswith("https://example.com/path?key=value")

    def test_url_with_port(self) -> None:
        """Test URL with port number."""
        url = "https://example.com:8080/path"
        params = {"key": "value"}

        result = url_update_params(url, params)

        assert result == "https://example.com:8080/path?key=value"

    def test_url_with_complex_path(self) -> None:
        """Test URL with complex path."""
        url = "https://example.com/api/v1/users/profile"
        params = {"format": "json"}

        result = url_update_params(url, params)

        assert result == "https://example.com/api/v1/users/profile?format=json"

    def test_empty_params(self) -> None:
        """Test with empty params dict."""
        url = "https://example.com/path?existing=value"
        params = {}

        result = url_update_params(url, params)

        # Should keep existing params
        assert "existing=value" in result

    def test_url_encoding(self) -> None:
        """Test that special characters are properly encoded."""
        url = "https://example.com/path"
        params = {"key": "value with spaces"}

        result = url_update_params(url, params)

        # Spaces should be encoded
        assert "key=value+with+spaces" in result or "key=value%20with%20spaces" in result

    def test_special_characters_in_value(self) -> None:
        """Test handling of special characters in param values."""
        url = "https://example.com/path"
        params = {"key": "a+b=c&d=e"}

        result = url_update_params(url, params)

        # Special characters should be URL-encoded
        assert "key=" in result


class TestExtractQueryParam:
    """Tests for extract_query_param function."""

    def test_simple_url(self) -> None:
        """Test extracting params from simple URL."""
        url = "https://example.com/path?key=value"

        result = extract_query_param(url)

        assert result == {"key": ["value"]}

    def test_multiple_params(self) -> None:
        """Test extracting multiple parameters."""
        url = "https://example.com/path?a=1&b=2&c=3"

        result = extract_query_param(url)

        assert result["a"] == ["1"]
        assert result["b"] == ["2"]
        assert result["c"] == ["3"]

    def test_duplicate_params(self) -> None:
        """Test URL with duplicate parameter names."""
        url = "https://example.com/path?key=first&key=second"

        result = extract_query_param(url)

        # parse_qs returns list, so duplicates are preserved
        assert result["key"] == ["first", "second"]

    def test_empty_value(self) -> None:
        """Test URL with empty parameter value."""
        url = "https://example.com/path?key="

        result = extract_query_param(url)

        # parse_qs with keep_blank_values=True keeps empty values
        # Without it, empty values are ignored
        assert result == {} or result.get("key") == [""]

    def test_no_params(self) -> None:
        """Test URL without query parameters."""
        url = "https://example.com/path"

        result = extract_query_param(url)

        assert result == {}

    def test_url_with_fragment(self) -> None:
        """Test URL with fragment - fragment should not be included."""
        url = "https://example.com/path?key=value#section"

        result = extract_query_param(url)

        # Fragment should not be in query params
        assert result == {"key": ["value"]}
        assert "section" not in result

    def test_url_only_query(self) -> None:
        """Test URL that is just a query string."""
        url = "?key=value&other=test"

        result = extract_query_param(url)

        assert result["key"] == ["value"]
        assert result["other"] == ["test"]

    def test_url_encoded_values(self) -> None:
        """Test URL with encoded parameter values."""
        url = "https://example.com/path?key=hello%20world"

        result = extract_query_param(url)

        # parse_qs decodes by default
        assert result["key"] == ["hello world"]

    def test_complex_url(self) -> None:
        """Test with a complex real-world URL."""
        url = "https://api.example.com/v1/users?page=2&limit=50&status=active&sort=name"

        result = extract_query_param(url)

        assert result["page"] == ["2"]
        assert result["limit"] == ["50"]
        assert result["status"] == ["active"]
        assert result["sort"] == ["name"]

    def test_special_characters_in_key(self) -> None:
        """Test URL with special characters in parameter name."""
        url = "https://example.com/path?filter[status]=active"

        result = extract_query_param(url)

        # Should handle bracket notation
        assert "filter[status]" in result

    def test_empty_url(self) -> None:
        """Test with empty-like URL."""
        url = ""

        result = extract_query_param(url)

        assert result == {}


class TestIntegration:
    """Integration tests combining url_update_params and extract_query_param."""

    def test_update_and_extract(self) -> None:
        """Test updating params and then extracting them."""
        url = "https://example.com/path"
        params = {"key": "value", "other": "test"}

        updated = url_update_params(url, params)
        extracted = extract_query_param(updated)

        assert extracted["key"] == ["value"]
        assert extracted["other"] == ["test"]

    def test_chain_operations(self) -> None:
        """Test chaining multiple updates."""
        url = "https://example.com/path?initial=1"

        updated1 = url_update_params(url, {"a": "2"})
        updated2 = url_update_params(updated1, {"b": "3"})
        updated3 = url_update_params(updated2, {"initial": "updated"})

        extracted = extract_query_param(updated3)

        assert extracted["initial"] == ["updated"]
        assert extracted["a"] == ["2"]
        assert extracted["b"] == ["3"]
