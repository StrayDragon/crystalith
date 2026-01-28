from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.http_validation_error import HTTPValidationError
from ...models.source_summary_response import SourceSummaryResponse
from ...types import Response


def _get_kwargs(
    notebook_id: int,
    source_id: int,
) -> dict[str, Any]:
    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/v1/notebooks/{notebook_id}/sources/{source_id}/summary".format(
            notebook_id=quote(str(notebook_id), safe=""),
            source_id=quote(str(source_id), safe=""),
        ),
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> HTTPValidationError | SourceSummaryResponse | None:
    if response.status_code == 200:
        response_200 = SourceSummaryResponse.from_dict(response.json())

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
) -> Response[HTTPValidationError | SourceSummaryResponse]:
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
) -> Response[HTTPValidationError | SourceSummaryResponse]:
    """Get Source Summary

     Generate or retrieve summary for a specific source.

    Args:
        notebook_id (int):
        source_id (int):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[HTTPValidationError | SourceSummaryResponse]
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
) -> HTTPValidationError | SourceSummaryResponse | None:
    """Get Source Summary

     Generate or retrieve summary for a specific source.

    Args:
        notebook_id (int):
        source_id (int):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        HTTPValidationError | SourceSummaryResponse
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
) -> Response[HTTPValidationError | SourceSummaryResponse]:
    """Get Source Summary

     Generate or retrieve summary for a specific source.

    Args:
        notebook_id (int):
        source_id (int):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[HTTPValidationError | SourceSummaryResponse]
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
) -> HTTPValidationError | SourceSummaryResponse | None:
    """Get Source Summary

     Generate or retrieve summary for a specific source.

    Args:
        notebook_id (int):
        source_id (int):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        HTTPValidationError | SourceSummaryResponse
    """

    return (
        await asyncio_detailed(
            notebook_id=notebook_id,
            source_id=source_id,
            client=client,
        )
    ).parsed
