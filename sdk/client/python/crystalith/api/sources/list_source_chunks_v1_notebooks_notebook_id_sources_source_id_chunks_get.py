from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.chunk_read import ChunkRead
from ...models.http_validation_error import HTTPValidationError
from ...types import Response


def _get_kwargs(
    notebook_id: int,
    source_id: int,
) -> dict[str, Any]:
    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/v1/notebooks/{notebook_id}/sources/{source_id}/chunks".format(
            notebook_id=quote(str(notebook_id), safe=""),
            source_id=quote(str(source_id), safe=""),
        ),
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> HTTPValidationError | list[ChunkRead] | None:
    if response.status_code == 200:
        response_200 = []
        _response_200 = response.json()
        for response_200_item_data in _response_200:
            response_200_item = ChunkRead.from_dict(response_200_item_data)

            response_200.append(response_200_item)

        return response_200

    if response.status_code == 422:
        response_422 = HTTPValidationError.from_dict(response.json())

        return response_422

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[HTTPValidationError | list[ChunkRead]]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    notebook_id: int,
    source_id: int,
    *,
    client: AuthenticatedClient | Client,
) -> Response[HTTPValidationError | list[ChunkRead]]:
    """List Source Chunks

     获取来源的所有文本片段（chunks）。

    返回指定来源的所有文本片段，按 chunk_index 升序排列。
    每个片段包含：
    - id: 片段唯一标识
    - chunk_index: 片段索引（从0开始）
    - text: 片段文本内容
    - start_offset: 在原文中的起始位置
    - end_offset: 在原文中的结束位置
    - metadata: 片段元数据（如页码等）

    Args:
        notebook_id (int):
        source_id (int):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[HTTPValidationError | list[ChunkRead]]
    """

    kwargs = _get_kwargs(
        notebook_id=notebook_id,
        source_id=source_id,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    notebook_id: int,
    source_id: int,
    *,
    client: AuthenticatedClient | Client,
) -> HTTPValidationError | list[ChunkRead] | None:
    """List Source Chunks

     获取来源的所有文本片段（chunks）。

    返回指定来源的所有文本片段，按 chunk_index 升序排列。
    每个片段包含：
    - id: 片段唯一标识
    - chunk_index: 片段索引（从0开始）
    - text: 片段文本内容
    - start_offset: 在原文中的起始位置
    - end_offset: 在原文中的结束位置
    - metadata: 片段元数据（如页码等）

    Args:
        notebook_id (int):
        source_id (int):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        HTTPValidationError | list[ChunkRead]
    """

    return sync_detailed(
        notebook_id=notebook_id,
        source_id=source_id,
        client=client,
    ).parsed


async def asyncio_detailed(
    notebook_id: int,
    source_id: int,
    *,
    client: AuthenticatedClient | Client,
) -> Response[HTTPValidationError | list[ChunkRead]]:
    """List Source Chunks

     获取来源的所有文本片段（chunks）。

    返回指定来源的所有文本片段，按 chunk_index 升序排列。
    每个片段包含：
    - id: 片段唯一标识
    - chunk_index: 片段索引（从0开始）
    - text: 片段文本内容
    - start_offset: 在原文中的起始位置
    - end_offset: 在原文中的结束位置
    - metadata: 片段元数据（如页码等）

    Args:
        notebook_id (int):
        source_id (int):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[HTTPValidationError | list[ChunkRead]]
    """

    kwargs = _get_kwargs(
        notebook_id=notebook_id,
        source_id=source_id,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    notebook_id: int,
    source_id: int,
    *,
    client: AuthenticatedClient | Client,
) -> HTTPValidationError | list[ChunkRead] | None:
    """List Source Chunks

     获取来源的所有文本片段（chunks）。

    返回指定来源的所有文本片段，按 chunk_index 升序排列。
    每个片段包含：
    - id: 片段唯一标识
    - chunk_index: 片段索引（从0开始）
    - text: 片段文本内容
    - start_offset: 在原文中的起始位置
    - end_offset: 在原文中的结束位置
    - metadata: 片段元数据（如页码等）

    Args:
        notebook_id (int):
        source_id (int):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        HTTPValidationError | list[ChunkRead]
    """

    return (
        await asyncio_detailed(
            notebook_id=notebook_id,
            source_id=source_id,
            client=client,
        )
    ).parsed
