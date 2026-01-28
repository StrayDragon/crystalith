from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

from ..models.source_read_source_status import SourceReadSourceStatus
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.source_read_metadata_type_0 import SourceReadMetadataType0


T = TypeVar("T", bound="SourceRead")


@_attrs_define
class SourceRead:
    """
    Attributes:
        id (int):
        notebook_id (int):
        filename (str):
        mime_type (None | str):
        parser_type (str):
        status (SourceReadSourceStatus): 枚举值:

            * `processing`: 正在处理
            * `ready`: 处理完成
            * `failed`: 处理失败
        error_message (None | str):
        created_at (datetime.datetime):
        updated_at (datetime.datetime):
        metadata (None | SourceReadMetadataType0 | Unset):
        chunk_count (int | Unset):  Default: 0.
    """

    id: int
    notebook_id: int
    filename: str
    mime_type: None | str
    parser_type: str
    status: SourceReadSourceStatus
    error_message: None | str
    created_at: datetime.datetime
    updated_at: datetime.datetime
    metadata: None | SourceReadMetadataType0 | Unset = UNSET
    chunk_count: int | Unset = 0
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.source_read_metadata_type_0 import SourceReadMetadataType0

        id = self.id

        notebook_id = self.notebook_id

        filename = self.filename

        mime_type: None | str
        mime_type = self.mime_type

        parser_type = self.parser_type

        status = self.status.value

        error_message: None | str
        error_message = self.error_message

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        metadata: dict[str, Any] | None | Unset
        if isinstance(self.metadata, Unset):
            metadata = UNSET
        elif isinstance(self.metadata, SourceReadMetadataType0):
            metadata = self.metadata.to_dict()
        else:
            metadata = self.metadata

        chunk_count = self.chunk_count

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "notebook_id": notebook_id,
                "filename": filename,
                "mime_type": mime_type,
                "parser_type": parser_type,
                "status": status,
                "error_message": error_message,
                "created_at": created_at,
                "updated_at": updated_at,
            }
        )
        if metadata is not UNSET:
            field_dict["metadata"] = metadata
        if chunk_count is not UNSET:
            field_dict["chunk_count"] = chunk_count

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.source_read_metadata_type_0 import SourceReadMetadataType0

        d = dict(src_dict)
        id = d.pop("id")

        notebook_id = d.pop("notebook_id")

        filename = d.pop("filename")

        def _parse_mime_type(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        mime_type = _parse_mime_type(d.pop("mime_type"))

        parser_type = d.pop("parser_type")

        status = SourceReadSourceStatus(d.pop("status"))

        def _parse_error_message(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        error_message = _parse_error_message(d.pop("error_message"))

        created_at = isoparse(d.pop("created_at"))

        updated_at = isoparse(d.pop("updated_at"))

        def _parse_metadata(data: object) -> None | SourceReadMetadataType0 | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                metadata_type_0 = SourceReadMetadataType0.from_dict(data)

                return metadata_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | SourceReadMetadataType0 | Unset, data)

        metadata = _parse_metadata(d.pop("metadata", UNSET))

        chunk_count = d.pop("chunk_count", UNSET)

        source_read = cls(
            id=id,
            notebook_id=notebook_id,
            filename=filename,
            mime_type=mime_type,
            parser_type=parser_type,
            status=status,
            error_message=error_message,
            created_at=created_at,
            updated_at=updated_at,
            metadata=metadata,
            chunk_count=chunk_count,
        )

        source_read.additional_properties = d
        return source_read

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
