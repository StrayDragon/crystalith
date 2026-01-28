from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.http_validation_error import HTTPValidationError
from ...models.refine_request import RefineRequest
from ...models.refine_response import RefineResponse
from ...types import Response


def _get_kwargs(
    notebook_id: int,
    *,
    body: RefineRequest,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/notebooks/{notebook_id}/refine".format(
            notebook_id=quote(str(notebook_id), safe=""),
        ),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> HTTPValidationError | RefineResponse | None:
    if response.status_code == 200:
        response_200 = RefineResponse.from_dict(response.json())

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
) -> Response[HTTPValidationError | RefineResponse]:
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
    body: RefineRequest,
) -> Response[HTTPValidationError | RefineResponse]:
    """Refine

    Args:
        notebook_id (int):
        body (RefineRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[HTTPValidationError | RefineResponse]
    """

    kwargs = _get_kwargs(
        notebook_id=notebook_id,
        body=body,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    notebook_id: int,
    *,
    client: AuthenticatedClient | Client,
    body: RefineRequest,
) -> HTTPValidationError | RefineResponse | None:
    """Refine

    Args:
        notebook_id (int):
        body (RefineRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        HTTPValidationError | RefineResponse
    """

    return sync_detailed(
        notebook_id=notebook_id,
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    notebook_id: int,
    *,
    client: AuthenticatedClient | Client,
    body: RefineRequest,
) -> Response[HTTPValidationError | RefineResponse]:
    """Refine

    Args:
        notebook_id (int):
        body (RefineRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[HTTPValidationError | RefineResponse]
    """

    kwargs = _get_kwargs(
        notebook_id=notebook_id,
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    notebook_id: int,
    *,
    client: AuthenticatedClient | Client,
    body: RefineRequest,
) -> HTTPValidationError | RefineResponse | None:
    """Refine

    Args:
        notebook_id (int):
        body (RefineRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        HTTPValidationError | RefineResponse
    """

    return (
        await asyncio_detailed(
            notebook_id=notebook_id,
            client=client,
            body=body,
        )
    ).parsed
