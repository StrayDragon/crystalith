from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.http_validation_error import HTTPValidationError
from ...models.source_from_url_request import SourceFromUrlRequest
from ...models.source_read import SourceRead
from ...types import Response


def _get_kwargs(
    notebook_id: int,
    *,
    body: SourceFromUrlRequest,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/notebooks/{notebook_id}/sources/from-url".format(
            notebook_id=quote(str(notebook_id), safe=""),
        ),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> HTTPValidationError | SourceRead | None:
    if response.status_code == 201:
        response_201 = SourceRead.from_dict(response.json())

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
) -> Response[HTTPValidationError | SourceRead]:
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
    body: SourceFromUrlRequest,
) -> Response[HTTPValidationError | SourceRead]:
    """Create Source From Url

     Create a source from a URL.

    Supports two modes:
    - `link`: Save URL, title, and snippet as a lightweight source
    - `fetch`: Fetch the webpage content and parse it as a full source

    For `fetch` mode, you can optionally specify an extractor:
    - `trafilatura`: Local extraction using trafilatura library (default)
    - `firecrawl`: External API using Firecrawl service
    - `browserless`: Browser rendering using Browserless + Playwright

    Args:
        notebook_id (int):
        body (SourceFromUrlRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[HTTPValidationError | SourceRead]
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
    body: SourceFromUrlRequest,
) -> HTTPValidationError | SourceRead | None:
    """Create Source From Url

     Create a source from a URL.

    Supports two modes:
    - `link`: Save URL, title, and snippet as a lightweight source
    - `fetch`: Fetch the webpage content and parse it as a full source

    For `fetch` mode, you can optionally specify an extractor:
    - `trafilatura`: Local extraction using trafilatura library (default)
    - `firecrawl`: External API using Firecrawl service
    - `browserless`: Browser rendering using Browserless + Playwright

    Args:
        notebook_id (int):
        body (SourceFromUrlRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        HTTPValidationError | SourceRead
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
    body: SourceFromUrlRequest,
) -> Response[HTTPValidationError | SourceRead]:
    """Create Source From Url

     Create a source from a URL.

    Supports two modes:
    - `link`: Save URL, title, and snippet as a lightweight source
    - `fetch`: Fetch the webpage content and parse it as a full source

    For `fetch` mode, you can optionally specify an extractor:
    - `trafilatura`: Local extraction using trafilatura library (default)
    - `firecrawl`: External API using Firecrawl service
    - `browserless`: Browser rendering using Browserless + Playwright

    Args:
        notebook_id (int):
        body (SourceFromUrlRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[HTTPValidationError | SourceRead]
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
    body: SourceFromUrlRequest,
) -> HTTPValidationError | SourceRead | None:
    """Create Source From Url

     Create a source from a URL.

    Supports two modes:
    - `link`: Save URL, title, and snippet as a lightweight source
    - `fetch`: Fetch the webpage content and parse it as a full source

    For `fetch` mode, you can optionally specify an extractor:
    - `trafilatura`: Local extraction using trafilatura library (default)
    - `firecrawl`: External API using Firecrawl service
    - `browserless`: Browser rendering using Browserless + Playwright

    Args:
        notebook_id (int):
        body (SourceFromUrlRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        HTTPValidationError | SourceRead
    """

    return (
        await asyncio_detailed(
            notebook_id=notebook_id,
            client=client,
            body=body,
        )
    ).parsed
