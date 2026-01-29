from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.http_validation_error import HTTPValidationError
from ...models.list_models_v1_models_get_role_type_0 import ListModelsV1ModelsGetRoleType0
from ...models.models_list_response import ModelsListResponse
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    role: ListModelsV1ModelsGetRoleType0 | None | Unset = UNSET,
    capability: None | str | Unset = UNSET,
) -> dict[str, Any]:
    params: dict[str, Any] = {}

    json_role: None | str | Unset
    if isinstance(role, Unset):
        json_role = UNSET
    elif isinstance(role, ListModelsV1ModelsGetRoleType0):
        json_role = role.value
    else:
        json_role = role
    params["role"] = json_role

    json_capability: None | str | Unset
    if isinstance(capability, Unset):
        json_capability = UNSET
    else:
        json_capability = capability
    params["capability"] = json_capability

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/v1/models",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> HTTPValidationError | ModelsListResponse | None:
    if response.status_code == 200:
        response_200 = ModelsListResponse.from_dict(response.json())

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
) -> Response[HTTPValidationError | ModelsListResponse]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    role: ListModelsV1ModelsGetRoleType0 | None | Unset = UNSET,
    capability: None | str | Unset = UNSET,
) -> Response[HTTPValidationError | ModelsListResponse]:
    """List Models

     List all available AI models.

    Optionally filter by role (chat, embed, edit, autocomplete) or capability.

    Args:
        role (ListModelsV1ModelsGetRoleType0 | None | Unset):
        capability (None | str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[HTTPValidationError | ModelsListResponse]
    """

    kwargs = _get_kwargs(
        role=role,
        capability=capability,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient | Client,
    role: ListModelsV1ModelsGetRoleType0 | None | Unset = UNSET,
    capability: None | str | Unset = UNSET,
) -> HTTPValidationError | ModelsListResponse | None:
    """List Models

     List all available AI models.

    Optionally filter by role (chat, embed, edit, autocomplete) or capability.

    Args:
        role (ListModelsV1ModelsGetRoleType0 | None | Unset):
        capability (None | str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        HTTPValidationError | ModelsListResponse
    """

    return sync_detailed(
        client=client,
        role=role,
        capability=capability,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    role: ListModelsV1ModelsGetRoleType0 | None | Unset = UNSET,
    capability: None | str | Unset = UNSET,
) -> Response[HTTPValidationError | ModelsListResponse]:
    """List Models

     List all available AI models.

    Optionally filter by role (chat, embed, edit, autocomplete) or capability.

    Args:
        role (ListModelsV1ModelsGetRoleType0 | None | Unset):
        capability (None | str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[HTTPValidationError | ModelsListResponse]
    """

    kwargs = _get_kwargs(
        role=role,
        capability=capability,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    role: ListModelsV1ModelsGetRoleType0 | None | Unset = UNSET,
    capability: None | str | Unset = UNSET,
) -> HTTPValidationError | ModelsListResponse | None:
    """List Models

     List all available AI models.

    Optionally filter by role (chat, embed, edit, autocomplete) or capability.

    Args:
        role (ListModelsV1ModelsGetRoleType0 | None | Unset):
        capability (None | str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        HTTPValidationError | ModelsListResponse
    """

    return (
        await asyncio_detailed(
            client=client,
            role=role,
            capability=capability,
        )
    ).parsed
