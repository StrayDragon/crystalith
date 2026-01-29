from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.create_output_v1_notebooks_notebook_id_outputs_output_type_post_output_type import (
    CreateOutputV1NotebooksNotebookIdOutputsOutputTypePostOutputType,
)
from ...models.http_validation_error import HTTPValidationError
from ...models.output_generate_request import OutputGenerateRequest
from ...models.output_read import OutputRead
from ...types import Response


def _get_kwargs(
    notebook_id: int,
    output_type: CreateOutputV1NotebooksNotebookIdOutputsOutputTypePostOutputType = CreateOutputV1NotebooksNotebookIdOutputsOutputTypePostOutputType.PARAGRAPH,
    *,
    body: OutputGenerateRequest,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/notebooks/{notebook_id}/outputs/{output_type}".format(
            notebook_id=quote(str(notebook_id), safe=""),
            output_type=quote(str(output_type), safe=""),
        ),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> HTTPValidationError | OutputRead | None:
    if response.status_code == 201:
        response_201 = OutputRead.from_dict(response.json())

        return response_201

    if response.status_code == 422:
        response_422 = HTTPValidationError.from_dict(response.json())

        return response_422

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[HTTPValidationError | OutputRead]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    notebook_id: int,
    output_type: CreateOutputV1NotebooksNotebookIdOutputsOutputTypePostOutputType = CreateOutputV1NotebooksNotebookIdOutputsOutputTypePostOutputType.PARAGRAPH,
    *,
    client: AuthenticatedClient | Client,
    body: OutputGenerateRequest,
) -> Response[HTTPValidationError | OutputRead]:
    """Create Output

    Args:
        notebook_id (int):
        output_type (CreateOutputV1NotebooksNotebookIdOutputsOutputTypePostOutputType): 枚举值:

            * `FAQ`: 问答清单
            * `GUIDE`: 学习/行动指南
            * `TIMELINE`: 关键事件序列
            * `MINDMAP`: 主题层级结构
            * `QUIZ`: 知识检验
            * `BRIEFING`: 高层摘要
            * `SLIDES`: 演示文稿
            * `PARAGRAPH`: 段落摘要
            * `BULLETS`: 要点列表
            * `STRUCTURED`: 结构化摘要 Default:
            CreateOutputV1NotebooksNotebookIdOutputsOutputTypePostOutputType.PARAGRAPH.
        body (OutputGenerateRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[HTTPValidationError | OutputRead]
    """

    kwargs = _get_kwargs(
        notebook_id=notebook_id,
        output_type=output_type,
        body=body,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    notebook_id: int,
    output_type: CreateOutputV1NotebooksNotebookIdOutputsOutputTypePostOutputType = CreateOutputV1NotebooksNotebookIdOutputsOutputTypePostOutputType.PARAGRAPH,
    *,
    client: AuthenticatedClient | Client,
    body: OutputGenerateRequest,
) -> HTTPValidationError | OutputRead | None:
    """Create Output

    Args:
        notebook_id (int):
        output_type (CreateOutputV1NotebooksNotebookIdOutputsOutputTypePostOutputType): 枚举值:

            * `FAQ`: 问答清单
            * `GUIDE`: 学习/行动指南
            * `TIMELINE`: 关键事件序列
            * `MINDMAP`: 主题层级结构
            * `QUIZ`: 知识检验
            * `BRIEFING`: 高层摘要
            * `SLIDES`: 演示文稿
            * `PARAGRAPH`: 段落摘要
            * `BULLETS`: 要点列表
            * `STRUCTURED`: 结构化摘要 Default:
            CreateOutputV1NotebooksNotebookIdOutputsOutputTypePostOutputType.PARAGRAPH.
        body (OutputGenerateRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        HTTPValidationError | OutputRead
    """

    return sync_detailed(
        notebook_id=notebook_id,
        output_type=output_type,
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    notebook_id: int,
    output_type: CreateOutputV1NotebooksNotebookIdOutputsOutputTypePostOutputType = CreateOutputV1NotebooksNotebookIdOutputsOutputTypePostOutputType.PARAGRAPH,
    *,
    client: AuthenticatedClient | Client,
    body: OutputGenerateRequest,
) -> Response[HTTPValidationError | OutputRead]:
    """Create Output

    Args:
        notebook_id (int):
        output_type (CreateOutputV1NotebooksNotebookIdOutputsOutputTypePostOutputType): 枚举值:

            * `FAQ`: 问答清单
            * `GUIDE`: 学习/行动指南
            * `TIMELINE`: 关键事件序列
            * `MINDMAP`: 主题层级结构
            * `QUIZ`: 知识检验
            * `BRIEFING`: 高层摘要
            * `SLIDES`: 演示文稿
            * `PARAGRAPH`: 段落摘要
            * `BULLETS`: 要点列表
            * `STRUCTURED`: 结构化摘要 Default:
            CreateOutputV1NotebooksNotebookIdOutputsOutputTypePostOutputType.PARAGRAPH.
        body (OutputGenerateRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[HTTPValidationError | OutputRead]
    """

    kwargs = _get_kwargs(
        notebook_id=notebook_id,
        output_type=output_type,
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    notebook_id: int,
    output_type: CreateOutputV1NotebooksNotebookIdOutputsOutputTypePostOutputType = CreateOutputV1NotebooksNotebookIdOutputsOutputTypePostOutputType.PARAGRAPH,
    *,
    client: AuthenticatedClient | Client,
    body: OutputGenerateRequest,
) -> HTTPValidationError | OutputRead | None:
    """Create Output

    Args:
        notebook_id (int):
        output_type (CreateOutputV1NotebooksNotebookIdOutputsOutputTypePostOutputType): 枚举值:

            * `FAQ`: 问答清单
            * `GUIDE`: 学习/行动指南
            * `TIMELINE`: 关键事件序列
            * `MINDMAP`: 主题层级结构
            * `QUIZ`: 知识检验
            * `BRIEFING`: 高层摘要
            * `SLIDES`: 演示文稿
            * `PARAGRAPH`: 段落摘要
            * `BULLETS`: 要点列表
            * `STRUCTURED`: 结构化摘要 Default:
            CreateOutputV1NotebooksNotebookIdOutputsOutputTypePostOutputType.PARAGRAPH.
        body (OutputGenerateRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        HTTPValidationError | OutputRead
    """

    return (
        await asyncio_detailed(
            notebook_id=notebook_id,
            output_type=output_type,
            client=client,
            body=body,
        )
    ).parsed
