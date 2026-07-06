from __future__ import annotations

from fastapi import Depends
from lush_fastapix import FastAPIX

from crystalith.features.analysis.api import router as analysis_router
from crystalith.features.citations.api import router as citations_router
from crystalith.features.commands.api import router as commands_router
from crystalith.features.messages.api import router as messages_router
from crystalith.features.models.api import router as models_router
from crystalith.features.notebooks.api import router as notebooks_router
from crystalith.features.outputs.api import router as outputs_router
from crystalith.features.prompt_presets.api import router as prompt_presets_router
from crystalith.features.qa.api import router as qa_router
from crystalith.features.refine.api import router as refine_router
from crystalith.features.research.api import router as research_router
from crystalith.features.sessions.api import router as sessions_router
from crystalith.features.source_connectors.api import router as source_connectors_router
from crystalith.features.sources.api import router as sources_router
from crystalith.features.studio.api import router as slides_router
from crystalith.features.tasks.api import router as tasks_router
from crystalith.features.templates.api import router as templates_router
from crystalith.features.ui.api import router as ui_router
from crystalith.features.workspace.api import router as workspace_router
from crystalith.web.auth import require_api_key


def register_routers(app: FastAPIX) -> None:
    auth_dependencies = [Depends(require_api_key)]

    app.include_router(notebooks_router, dependencies=auth_dependencies)
    app.include_router(sessions_router, dependencies=auth_dependencies)
    app.include_router(messages_router, dependencies=auth_dependencies)
    app.include_router(analysis_router, dependencies=auth_dependencies)
    app.include_router(models_router, dependencies=auth_dependencies)
    app.include_router(qa_router, dependencies=auth_dependencies)
    app.include_router(sources_router, dependencies=auth_dependencies)
    app.include_router(source_connectors_router, dependencies=auth_dependencies)
    app.include_router(citations_router, dependencies=auth_dependencies)
    app.include_router(commands_router, dependencies=auth_dependencies)
    app.include_router(prompt_presets_router, dependencies=auth_dependencies)
    app.include_router(outputs_router, dependencies=auth_dependencies)
    app.include_router(refine_router, dependencies=auth_dependencies)
    app.include_router(slides_router, dependencies=auth_dependencies)
    app.include_router(research_router, dependencies=auth_dependencies)
    app.include_router(tasks_router, dependencies=auth_dependencies)
    app.include_router(templates_router, dependencies=auth_dependencies)
    app.include_router(ui_router, dependencies=auth_dependencies)
    app.include_router(workspace_router, dependencies=auth_dependencies)
