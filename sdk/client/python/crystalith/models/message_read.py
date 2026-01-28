from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

from ..models.message_read_role import MessageReadRole

if TYPE_CHECKING:
    from ..models.citation import Citation


T = TypeVar("T", bound="MessageRead")


@_attrs_define
class MessageRead:
    """
    Attributes:
        id (int):
        session_id (int):
        role (MessageReadRole):
        content (str):
        citations (list[Citation] | None):
        created_at (datetime.datetime):
        updated_at (datetime.datetime):
    """

    id: int
    session_id: int
    role: MessageReadRole
    content: str
    citations: list[Citation] | None
    created_at: datetime.datetime
    updated_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        session_id = self.session_id

        role = self.role.value

        content = self.content

        citations: list[dict[str, Any]] | None
        if isinstance(self.citations, list):
            citations = []
            for citations_type_0_item_data in self.citations:
                citations_type_0_item = citations_type_0_item_data.to_dict()
                citations.append(citations_type_0_item)

        else:
            citations = self.citations

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "session_id": session_id,
                "role": role,
                "content": content,
                "citations": citations,
                "created_at": created_at,
                "updated_at": updated_at,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.citation import Citation

        d = dict(src_dict)
        id = d.pop("id")

        session_id = d.pop("session_id")

        role = MessageReadRole(d.pop("role"))

        content = d.pop("content")

        def _parse_citations(data: object) -> list[Citation] | None:
            if data is None:
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                citations_type_0 = []
                _citations_type_0 = data
                for citations_type_0_item_data in _citations_type_0:
                    citations_type_0_item = Citation.from_dict(citations_type_0_item_data)

                    citations_type_0.append(citations_type_0_item)

                return citations_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[Citation] | None, data)

        citations = _parse_citations(d.pop("citations"))

        created_at = isoparse(d.pop("created_at"))

        updated_at = isoparse(d.pop("updated_at"))

        message_read = cls(
            id=id,
            session_id=session_id,
            role=role,
            content=content,
            citations=citations,
            created_at=created_at,
            updated_at=updated_at,
        )

        message_read.additional_properties = d
        return message_read

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
