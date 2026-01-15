from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.api.deps import get_db_session
from crystalith.db import Notebook

from .types import AudioOverviewNotImplemented, AudioOverviewRequest, AudioOverviewResponse


router = APIRouter(prefix="/v1/notebooks/{notebook_id}/audio-overview", tags=["audio-overview"])

_NOT_IMPLEMENTED_RESPONSE = {
    "error": "Audio overview is not yet implemented",
    "status": "coming_soon",
}


@router.post(
    "",
    response_model=AudioOverviewResponse,
    responses={
        status.HTTP_501_NOT_IMPLEMENTED: {"model": AudioOverviewNotImplemented},
    },
)
async def create_audio_overview(
    notebook_id: int,
    _payload: AudioOverviewRequest,
    session: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")

    return JSONResponse(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        content=_NOT_IMPLEMENTED_RESPONSE,
    )
