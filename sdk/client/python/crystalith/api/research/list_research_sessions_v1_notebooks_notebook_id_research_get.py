from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.http_validation_error import HTTPValidationError
from ...models.list_research_sessions_v1_notebooks_notebook_id_research_get_research_status import (
    ListResearchSessionsV1NotebooksNotebookIdResearchGetResearchStatus,
)
from ...models.research_session_list_item import ResearchSessionListItem
from ...types import UNSET, Response, Unset


def _get_kwargs(
    notebook_id: int,
    *,
    offset: int | Unset = 0,
    limit: int | Unset = 50,
    status: ListResearchSessionsV1NotebooksNotebookIdResearchGetResearchStatus | None | Unset = UNSET,
) -> dict[str, Any]:
    params: dict[str, Any] = {}

    params["offset"] = offset

    params["limit"] = limit

    json_status: None | str | Unset
    if isinstance(status, Unset):
        json_status = UNSET
    elif isinstance(status, ListResearchSessionsV1NotebooksNotebookIdResearchGetResearchStatus):
        json_status = status.value
    else:
        json_status = status
    params["status"] = json_status

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/v1/notebooks/{notebook_id}/research".format(
            notebook_id=quote(str(notebook_id), safe=""),
        ),
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> HTTPValidationError | list[ResearchSessionListItem] | None:
    if response.status_code == 200:
        response_200 = []
        _response_200 = response.json()
        for response_200_item_data in _response_200:
            response_200_item = ResearchSessionListItem.from_dict(response_200_item_data)

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
) -> Response[HTTPValidationError | list[ResearchSessionListItem]]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    notebook_id: int,
    *,
    client: AuthenticatedClient | Client,
    offset: int | Unset = 0,
    limit: int | Unset = 50,
    status: ListResearchSessionsV1NotebooksNotebookIdResearchGetResearchStatus | None | Unset = UNSET,
) -> Response[HTTPValidationError | list[ResearchSessionListItem]]:
    """List Research Sessions

     List research sessions for a notebook.

    Args:
        notebook_id (int):
        offset (int | Unset):  Default: 0.
        limit (int | Unset):  Default: 50.
        status (ListResearchSessionsV1NotebooksNotebookIdResearchGetResearchStatus | None |
            Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[HTTPValidationError | list[ResearchSessionListItem]]
    """

    kwargs = _get_kwargs(
        notebook_id=notebook_id,
        offset=offset,
        limit=limit,
        status=status,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    notebook_id: int,
    *,
    client: AuthenticatedClient | Client,
    offset: int | Unset = 0,
    limit: int | Unset = 50,
    status: ListResearchSessionsV1NotebooksNotebookIdResearchGetResearchStatus | None | Unset = UNSET,
) -> HTTPValidationError | list[ResearchSessionListItem] | None:
    """List Research Sessions

     List research sessions for a notebook.

    Args:
        notebook_id (int):
        offset (int | Unset):  Default: 0.
        limit (int | Unset):  Default: 50.
        status (ListResearchSessionsV1NotebooksNotebookIdResearchGetResearchStatus | None |
            Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        HTTPValidationError | list[ResearchSessionListItem]
    """

    return sync_detailed(
        notebook_id=notebook_id,
        client=client,
        offset=offset,
        limit=limit,
        status=status,
    ).parsed


async def asyncio_detailed(
    notebook_id: int,
    *,
    client: AuthenticatedClient | Client,
    offset: int | Unset = 0,
    limit: int | Unset = 50,
    status: ListResearchSessionsV1NotebooksNotebookIdResearchGetResearchStatus | None | Unset = UNSET,
) -> Response[HTTPValidationError | list[ResearchSessionListItem]]:
    """List Research Sessions

     List research sessions for a notebook.

    Args:
        notebook_id (int):
        offset (int | Unset):  Default: 0.
        limit (int | Unset):  Default: 50.
        status (ListResearchSessionsV1NotebooksNotebookIdResearchGetResearchStatus | None |
            Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[HTTPValidationError | list[ResearchSessionListItem]]
    """

    kwargs = _get_kwargs(
        notebook_id=notebook_id,
        offset=offset,
        limit=limit,
        status=status,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    notebook_id: int,
    *,
    client: AuthenticatedClient | Client,
    offset: int | Unset = 0,
    limit: int | Unset = 50,
    status: ListResearchSessionsV1NotebooksNotebookIdResearchGetResearchStatus | None | Unset = UNSET,
) -> HTTPValidationError | list[ResearchSessionListItem] | None:
    """List Research Sessions

     List research sessions for a notebook.

    Args:
        notebook_id (int):
        offset (int | Unset):  Default: 0.
        limit (int | Unset):  Default: 50.
        status (ListResearchSessionsV1NotebooksNotebookIdResearchGetResearchStatus | None |
            Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        HTTPValidationError | list[ResearchSessionListItem]
    """

    return (
        await asyncio_detailed(
            notebook_id=notebook_id,
            client=client,
            offset=offset,
            limit=limit,
            status=status,
        )
    ).parsed
