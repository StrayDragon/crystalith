from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.http_validation_error import HTTPValidationError
from ...models.qa_request import QARequest
from ...types import Response


def _get_kwargs(
    notebook_id: int,
    *,
    body: QARequest,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/notebooks/{notebook_id}/qa/stream".format(
            notebook_id=quote(str(notebook_id), safe=""),
        ),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
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
    *,
    client: AuthenticatedClient | Client,
    body: QARequest,
) -> Response[Any | HTTPValidationError]:
    r"""Ask Question Stream

     Stream QA response using Server-Sent Events.

    Events:
    - `chunk`: Text chunk `{\"text\": \"...\"}`
    - `done`: Completion `{\"citations\": [...], \"evidence\": bool, \"confidence\": float, ...}`
    - `error`: Error `{\"message\": \"...\"}`

    Args:
        notebook_id (int):
        body (QARequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Any | HTTPValidationError]
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
    body: QARequest,
) -> Any | HTTPValidationError | None:
    r"""Ask Question Stream

     Stream QA response using Server-Sent Events.

    Events:
    - `chunk`: Text chunk `{\"text\": \"...\"}`
    - `done`: Completion `{\"citations\": [...], \"evidence\": bool, \"confidence\": float, ...}`
    - `error`: Error `{\"message\": \"...\"}`

    Args:
        notebook_id (int):
        body (QARequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Any | HTTPValidationError
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
    body: QARequest,
) -> Response[Any | HTTPValidationError]:
    r"""Ask Question Stream

     Stream QA response using Server-Sent Events.

    Events:
    - `chunk`: Text chunk `{\"text\": \"...\"}`
    - `done`: Completion `{\"citations\": [...], \"evidence\": bool, \"confidence\": float, ...}`
    - `error`: Error `{\"message\": \"...\"}`

    Args:
        notebook_id (int):
        body (QARequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Any | HTTPValidationError]
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
    body: QARequest,
) -> Any | HTTPValidationError | None:
    r"""Ask Question Stream

     Stream QA response using Server-Sent Events.

    Events:
    - `chunk`: Text chunk `{\"text\": \"...\"}`
    - `done`: Completion `{\"citations\": [...], \"evidence\": bool, \"confidence\": float, ...}`
    - `error`: Error `{\"message\": \"...\"}`

    Args:
        notebook_id (int):
        body (QARequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Any | HTTPValidationError
    """

    return (
        await asyncio_detailed(
            notebook_id=notebook_id,
            client=client,
            body=body,
        )
    ).parsed
