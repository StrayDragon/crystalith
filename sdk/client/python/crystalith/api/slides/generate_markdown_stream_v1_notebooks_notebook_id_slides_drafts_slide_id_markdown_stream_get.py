from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.http_validation_error import HTTPValidationError
from ...types import UNSET, Response, Unset


def _get_kwargs(
    notebook_id: int,
    slide_id: int,
    *,
    model_id: None | str | Unset = UNSET,
) -> dict[str, Any]:
    params: dict[str, Any] = {}

    json_model_id: None | str | Unset
    if isinstance(model_id, Unset):
        json_model_id = UNSET
    else:
        json_model_id = model_id
    params["model_id"] = json_model_id

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/v1/notebooks/{notebook_id}/slides/drafts/{slide_id}/markdown/stream".format(
            notebook_id=quote(str(notebook_id), safe=""),
            slide_id=quote(str(slide_id), safe=""),
        ),
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Any | HTTPValidationError | None:
    if response.status_code == 200:
        response_200 = response.json()
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
) -> Response[Any | HTTPValidationError]:
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
    model_id: None | str | Unset = UNSET,
) -> Response[Any | HTTPValidationError]:
    """Generate Markdown Stream

    Args:
        notebook_id (int):
        slide_id (int):
        model_id (None | str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Any | HTTPValidationError]
    """

    kwargs = _get_kwargs(
        notebook_id=notebook_id,
        slide_id=slide_id,
        model_id=model_id,
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
    model_id: None | str | Unset = UNSET,
) -> Any | HTTPValidationError | None:
    """Generate Markdown Stream

    Args:
        notebook_id (int):
        slide_id (int):
        model_id (None | str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Any | HTTPValidationError
    """

    return sync_detailed(
        notebook_id=notebook_id,
        slide_id=slide_id,
        client=client,
        model_id=model_id,
    ).parsed


async def asyncio_detailed(
    notebook_id: int,
    slide_id: int,
    *,
    client: AuthenticatedClient | Client,
    model_id: None | str | Unset = UNSET,
) -> Response[Any | HTTPValidationError]:
    """Generate Markdown Stream

    Args:
        notebook_id (int):
        slide_id (int):
        model_id (None | str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Any | HTTPValidationError]
    """

    kwargs = _get_kwargs(
        notebook_id=notebook_id,
        slide_id=slide_id,
        model_id=model_id,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    notebook_id: int,
    slide_id: int,
    *,
    client: AuthenticatedClient | Client,
    model_id: None | str | Unset = UNSET,
) -> Any | HTTPValidationError | None:
    """Generate Markdown Stream

    Args:
        notebook_id (int):
        slide_id (int):
        model_id (None | str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Any | HTTPValidationError
    """

    return (
        await asyncio_detailed(
            notebook_id=notebook_id,
            slide_id=slide_id,
            client=client,
            model_id=model_id,
        )
    ).parsed
