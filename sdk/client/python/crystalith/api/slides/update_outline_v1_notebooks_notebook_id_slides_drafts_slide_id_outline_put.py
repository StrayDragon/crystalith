from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.http_validation_error import HTTPValidationError
from ...models.slide_draft_read import SlideDraftRead
from ...models.slide_outline_update import SlideOutlineUpdate
from ...types import Response


def _get_kwargs(
    notebook_id: int,
    slide_id: int,
    *,
    body: SlideOutlineUpdate,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "put",
        "url": "/v1/notebooks/{notebook_id}/slides/drafts/{slide_id}/outline".format(
            notebook_id=quote(str(notebook_id), safe=""),
            slide_id=quote(str(slide_id), safe=""),
        ),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> HTTPValidationError | SlideDraftRead | None:
    if response.status_code == 200:
        response_200 = SlideDraftRead.from_dict(response.json())

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
) -> Response[HTTPValidationError | SlideDraftRead]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    notebook_id: int,
    slide_id: int,
    *,
    client: AuthenticatedClient | Client,
    body: SlideOutlineUpdate,
) -> Response[HTTPValidationError | SlideDraftRead]:
    """Update Outline

    Args:
        notebook_id (int):
        slide_id (int):
        body (SlideOutlineUpdate):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[HTTPValidationError | SlideDraftRead]
    """

    kwargs = _get_kwargs(
        notebook_id=notebook_id,
        slide_id=slide_id,
        body=body,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    notebook_id: int,
    slide_id: int,
    *,
    client: AuthenticatedClient | Client,
    body: SlideOutlineUpdate,
) -> HTTPValidationError | SlideDraftRead | None:
    """Update Outline

    Args:
        notebook_id (int):
        slide_id (int):
        body (SlideOutlineUpdate):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        HTTPValidationError | SlideDraftRead
    """

    return sync_detailed(
        notebook_id=notebook_id,
        slide_id=slide_id,
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    notebook_id: int,
    slide_id: int,
    *,
    client: AuthenticatedClient | Client,
    body: SlideOutlineUpdate,
) -> Response[HTTPValidationError | SlideDraftRead]:
    """Update Outline

    Args:
        notebook_id (int):
        slide_id (int):
        body (SlideOutlineUpdate):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[HTTPValidationError | SlideDraftRead]
    """

    kwargs = _get_kwargs(
        notebook_id=notebook_id,
        slide_id=slide_id,
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    notebook_id: int,
    slide_id: int,
    *,
    client: AuthenticatedClient | Client,
    body: SlideOutlineUpdate,
) -> HTTPValidationError | SlideDraftRead | None:
    """Update Outline

    Args:
        notebook_id (int):
        slide_id (int):
        body (SlideOutlineUpdate):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        HTTPValidationError | SlideDraftRead
    """

    return (
        await asyncio_detailed(
            notebook_id=notebook_id,
            slide_id=slide_id,
            client=client,
            body=body,
        )
    ).parsed
