from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.chunk_read_metadata_type_0 import ChunkReadMetadataType0


T = TypeVar("T", bound="ChunkRead")


@_attrs_define
class ChunkRead:
    """Response model for a text chunk.

    Attributes:
        id (int):
        chunk_index (int):
        text (str):
        start_offset (int | None):
        end_offset (int | None):
        metadata (ChunkReadMetadataType0 | None | Unset):
    """

    id: int
    chunk_index: int
    text: str
    start_offset: int | None
    end_offset: int | None
    metadata: ChunkReadMetadataType0 | None | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.chunk_read_metadata_type_0 import ChunkReadMetadataType0

        id = self.id

        chunk_index = self.chunk_index

        text = self.text

        start_offset: int | None
        start_offset = self.start_offset

        end_offset: int | None
        end_offset = self.end_offset

        metadata: dict[str, Any] | None | Unset
        if isinstance(self.metadata, Unset):
            metadata = UNSET
        elif isinstance(self.metadata, ChunkReadMetadataType0):
            metadata = self.metadata.to_dict()
        else:
            metadata = self.metadata

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "chunk_index": chunk_index,
                "text": text,
                "start_offset": start_offset,
                "end_offset": end_offset,
            }
        )
        if metadata is not UNSET:
            field_dict["metadata"] = metadata

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.chunk_read_metadata_type_0 import ChunkReadMetadataType0

        d = dict(src_dict)
        id = d.pop("id")

        chunk_index = d.pop("chunk_index")

        text = d.pop("text")

        def _parse_start_offset(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        start_offset = _parse_start_offset(d.pop("start_offset"))

        def _parse_end_offset(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        end_offset = _parse_end_offset(d.pop("end_offset"))

        def _parse_metadata(data: object) -> ChunkReadMetadataType0 | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                metadata_type_0 = ChunkReadMetadataType0.from_dict(data)

                return metadata_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(ChunkReadMetadataType0 | None | Unset, data)

        metadata = _parse_metadata(d.pop("metadata", UNSET))

        chunk_read = cls(
            id=id,
            chunk_index=chunk_index,
            text=text,
            start_offset=start_offset,
            end_offset=end_offset,
            metadata=metadata,
        )

        chunk_read.additional_properties = d
        return chunk_read

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
