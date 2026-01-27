from __future__ import annotations

from cl_fastapix import FastAPIX

from crystalith.features.analysis.api import router as analysis_router
from crystalith.features.messages.api import router as messages_router
from crystalith.features.models.api import router as models_router
from crystalith.features.notebooks.api import router as notebooks_router
from crystalith.features.outputs.api import router as outputs_router
from crystalith.features.qa.api import router as qa_router
from crystalith.features.refine.api import router as refine_router
from crystalith.features.research.api import router as research_router
from crystalith.features.sessions.api import router as sessions_router
from crystalith.features.sources.api import router as sources_router
from crystalith.features.studio.tools_api import router as workspace_slides_router
from crystalith.features.tasks.api import router as tasks_router
from crystalith.features.workspace.api import router as workspace_router
from crystalith.features.studio.api import router as slides_router


def register_routers(app: FastAPIX) -> None:
    app.include_router(notebooks_router)
    app.include_router(sessions_router)
    app.include_router(messages_router)
    app.include_router(analysis_router)
    app.include_router(models_router)
    app.include_router(qa_router)
    app.include_router(sources_router)
    app.include_router(outputs_router)
    app.include_router(refine_router)
    app.include_router(slides_router)
    app.include_router(research_router)
    app.include_router(tasks_router)
    app.include_router(workspace_slides_router)
    app.include_router(workspace_router)
