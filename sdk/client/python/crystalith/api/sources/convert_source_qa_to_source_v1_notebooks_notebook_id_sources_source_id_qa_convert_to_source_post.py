from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.convert_source_qa_to_source_request import ConvertSourceQAToSourceRequest
from ...models.convert_source_qa_to_source_response import ConvertSourceQAToSourceResponse
from ...models.http_validation_error import HTTPValidationError
from ...types import Response


def _get_kwargs(
    notebook_id: int,
    source_id: int,
    *,
    body: ConvertSourceQAToSourceRequest,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/notebooks/{notebook_id}/sources/{source_id}/qa/convert-to-source".format(
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
) -> ConvertSourceQAToSourceResponse | HTTPValidationError | None:
    if response.status_code == 201:
        response_201 = ConvertSourceQAToSourceResponse.from_dict(response.json())

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
) -> Response[ConvertSourceQAToSourceResponse | HTTPValidationError]:
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
    body: ConvertSourceQAToSourceRequest,
) -> Response[ConvertSourceQAToSourceResponse | HTTPValidationError]:
    """Convert Source Qa To Source

     Convert source QA conversation to a new source document for RAG queries.

    Args:
        notebook_id (int):
        source_id (int):
        body (ConvertSourceQAToSourceRequest): Request to convert source QA conversation to a new
            source.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ConvertSourceQAToSourceResponse | HTTPValidationError]
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
    body: ConvertSourceQAToSourceRequest,
) -> ConvertSourceQAToSourceResponse | HTTPValidationError | None:
    """Convert Source Qa To Source

     Convert source QA conversation to a new source document for RAG queries.

    Args:
        notebook_id (int):
        source_id (int):
        body (ConvertSourceQAToSourceRequest): Request to convert source QA conversation to a new
            source.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ConvertSourceQAToSourceResponse | HTTPValidationError
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
    body: ConvertSourceQAToSourceRequest,
) -> Response[ConvertSourceQAToSourceResponse | HTTPValidationError]:
    """Convert Source Qa To Source

     Convert source QA conversation to a new source document for RAG queries.

    Args:
        notebook_id (int):
        source_id (int):
        body (ConvertSourceQAToSourceRequest): Request to convert source QA conversation to a new
            source.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ConvertSourceQAToSourceResponse | HTTPValidationError]
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
    body: ConvertSourceQAToSourceRequest,
) -> ConvertSourceQAToSourceResponse | HTTPValidationError | None:
    """Convert Source Qa To Source

     Convert source QA conversation to a new source document for RAG queries.

    Args:
        notebook_id (int):
        source_id (int):
        body (ConvertSourceQAToSourceRequest): Request to convert source QA conversation to a new
            source.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ConvertSourceQAToSourceResponse | HTTPValidationError
    """

    return (
        await asyncio_detailed(
            notebook_id=notebook_id,
            source_id=source_id,
            client=client,
            body=body,
        )
    ).parsed
