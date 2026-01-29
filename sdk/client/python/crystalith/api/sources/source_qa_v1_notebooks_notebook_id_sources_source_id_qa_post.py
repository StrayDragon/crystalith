from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.http_validation_error import HTTPValidationError
from ...models.source_qa_request import SourceQARequest
from ...models.source_qa_response import SourceQAResponse
from ...types import Response


def _get_kwargs(
    notebook_id: int,
    source_id: int,
    *,
    body: SourceQARequest,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/notebooks/{notebook_id}/sources/{source_id}/qa".format(
            notebook_id=quote(str(notebook_id), safe=""),
            source_id=quote(str(source_id), safe=""),
        ),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> HTTPValidationError | SourceQAResponse | None:
    if response.status_code == 200:
        response_200 = SourceQAResponse.from_dict(response.json())

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
) -> Response[HTTPValidationError | SourceQAResponse]:
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
    body: SourceQARequest,
) -> Response[HTTPValidationError | SourceQAResponse]:
    """Source Qa

     Answer a question based on a specific source's content.

    Args:
        notebook_id (int):
        source_id (int):
        body (SourceQARequest): Request for source-specific QA.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[HTTPValidationError | SourceQAResponse]
    """

    kwargs = _get_kwargs(
        notebook_id=notebook_id,
        source_id=source_id,
        body=body,
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
    body: SourceQARequest,
) -> HTTPValidationError | SourceQAResponse | None:
    """Source Qa

     Answer a question based on a specific source's content.

    Args:
        notebook_id (int):
        source_id (int):
        body (SourceQARequest): Request for source-specific QA.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        HTTPValidationError | SourceQAResponse
    """

    return sync_detailed(
        notebook_id=notebook_id,
        source_id=source_id,
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    notebook_id: int,
    source_id: int,
    *,
    client: AuthenticatedClient | Client,
    body: SourceQARequest,
) -> Response[HTTPValidationError | SourceQAResponse]:
    """Source Qa

     Answer a question based on a specific source's content.

    Args:
        notebook_id (int):
        source_id (int):
        body (SourceQARequest): Request for source-specific QA.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[HTTPValidationError | SourceQAResponse]
    """

    kwargs = _get_kwargs(
        notebook_id=notebook_id,
        source_id=source_id,
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    notebook_id: int,
    source_id: int,
    *,
    client: AuthenticatedClient | Client,
    body: SourceQARequest,
) -> HTTPValidationError | SourceQAResponse | None:
    """Source Qa

     Answer a question based on a specific source's content.

    Args:
        notebook_id (int):
        source_id (int):
        body (SourceQARequest): Request for source-specific QA.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        HTTPValidationError | SourceQAResponse
    """

    return (
        await asyncio_detailed(
            notebook_id=notebook_id,
            source_id=source_id,
            client=client,
            body=body,
        )
    ).parsed
