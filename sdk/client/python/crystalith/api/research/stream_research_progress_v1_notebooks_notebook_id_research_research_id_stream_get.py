from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.http_validation_error import HTTPValidationError
from ...types import Response


def _get_kwargs(
    notebook_id: int,
    research_id: int,
) -> dict[str, Any]:
    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/v1/notebooks/{notebook_id}/research/{research_id}/stream".format(
            notebook_id=quote(str(notebook_id), safe=""),
            research_id=quote(str(research_id), safe=""),
        ),
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
    research_id: int,
    *,
    client: AuthenticatedClient | Client,
) -> Response[Any | HTTPValidationError]:
    r"""Stream Research Progress

     Stream research progress using Server-Sent Events.

    Events:
    - `status`: Status update `{\"status\": \"...\", \"iteration\": n}`
    - `plan_ready`: Search plan ready `{\"plan\": {...}}`
    - `search_progress`: Search progress `{\"query\": \"...\", \"completed\": n, \"total\": m}`
    - `search_result`: New result `{\"title\": \"...\", \"url\": \"...\"}`
    - `analysis`: Analysis complete `{\"summary\": \"...\", \"coverage\": 0.x}`
    - `report`: Final report `{\"report\": \"...\"}`
    - `done`: Research complete `{\"total_results\": n}`
    - `error`: Error `{\"message\": \"...\"}`

    Args:
        notebook_id (int):
        research_id (int):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Any | HTTPValidationError]
    """

    kwargs = _get_kwargs(
        notebook_id=notebook_id,
        research_id=research_id,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    notebook_id: int,
    research_id: int,
    *,
    client: AuthenticatedClient | Client,
) -> Any | HTTPValidationError | None:
    r"""Stream Research Progress

     Stream research progress using Server-Sent Events.

    Events:
    - `status`: Status update `{\"status\": \"...\", \"iteration\": n}`
    - `plan_ready`: Search plan ready `{\"plan\": {...}}`
    - `search_progress`: Search progress `{\"query\": \"...\", \"completed\": n, \"total\": m}`
    - `search_result`: New result `{\"title\": \"...\", \"url\": \"...\"}`
    - `analysis`: Analysis complete `{\"summary\": \"...\", \"coverage\": 0.x}`
    - `report`: Final report `{\"report\": \"...\"}`
    - `done`: Research complete `{\"total_results\": n}`
    - `error`: Error `{\"message\": \"...\"}`

    Args:
        notebook_id (int):
        research_id (int):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Any | HTTPValidationError
    """

    return sync_detailed(
        notebook_id=notebook_id,
        research_id=research_id,
        client=client,
    ).parsed


async def asyncio_detailed(
    notebook_id: int,
    research_id: int,
    *,
    client: AuthenticatedClient | Client,
) -> Response[Any | HTTPValidationError]:
    r"""Stream Research Progress

     Stream research progress using Server-Sent Events.

    Events:
    - `status`: Status update `{\"status\": \"...\", \"iteration\": n}`
    - `plan_ready`: Search plan ready `{\"plan\": {...}}`
    - `search_progress`: Search progress `{\"query\": \"...\", \"completed\": n, \"total\": m}`
    - `search_result`: New result `{\"title\": \"...\", \"url\": \"...\"}`
    - `analysis`: Analysis complete `{\"summary\": \"...\", \"coverage\": 0.x}`
    - `report`: Final report `{\"report\": \"...\"}`
    - `done`: Research complete `{\"total_results\": n}`
    - `error`: Error `{\"message\": \"...\"}`

    Args:
        notebook_id (int):
        research_id (int):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Any | HTTPValidationError]
    """

    kwargs = _get_kwargs(
        notebook_id=notebook_id,
        research_id=research_id,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    notebook_id: int,
    research_id: int,
    *,
    client: AuthenticatedClient | Client,
) -> Any | HTTPValidationError | None:
    r"""Stream Research Progress

     Stream research progress using Server-Sent Events.

    Events:
    - `status`: Status update `{\"status\": \"...\", \"iteration\": n}`
    - `plan_ready`: Search plan ready `{\"plan\": {...}}`
    - `search_progress`: Search progress `{\"query\": \"...\", \"completed\": n, \"total\": m}`
    - `search_result`: New result `{\"title\": \"...\", \"url\": \"...\"}`
    - `analysis`: Analysis complete `{\"summary\": \"...\", \"coverage\": 0.x}`
    - `report`: Final report `{\"report\": \"...\"}`
    - `done`: Research complete `{\"total_results\": n}`
    - `error`: Error `{\"message\": \"...\"}`

    Args:
        notebook_id (int):
        research_id (int):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Any | HTTPValidationError
    """

    return (
        await asyncio_detailed(
            notebook_id=notebook_id,
            research_id=research_id,
            client=client,
        )
    ).parsed
