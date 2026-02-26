from __future__ import annotations

import datetime
import json
from typing import cast

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from pydantic_ai.exceptions import UnexpectedModelBehavior
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from cl_logs.logging import get_logger

from crystalith.shared.agents.deps import StudioDeps
from crystalith.shared.agents.generation_preference import (
    GenerationPreference,
    tuning_for_preference,
    tuning_for_request,
)
from crystalith.shared.agents.models import ModelConfigurationError
from crystalith.shared.agents.output_graph import run_output_graph
from crystalith.shared.ai.interfaces import EmbeddingProvider
from crystalith.shared.cache import CacheProvider
from crystalith.shared.cache.epochs import bump_sources_epoch
from crystalith.shared.config import Settings
from crystalith.shared.db import Chunk, Notebook, Output, Source
from crystalith.shared.observability import new_trace_id
from crystalith.shared.types import OutputType, SourceStatus
from crystalith.shared.vector_storage import VectorStore, bump_vector_epoch

from crystalith.shared.deps import (
    get_cache_provider,
    get_db_session,
    get_embedding_provider,
    get_plugin_registry,
    get_settings,
    get_stage_limiters,
    get_vector_store,
)
from crystalith.shared.plugins import PluginRegistry
from crystalith.shared.json_types import JsonDict, JsonValue

from time import perf_counter
from crystalith.shared.source_diagnostics import (
    SOURCE_ERROR_EMBEDDING_FAILED,
    SOURCE_ERROR_INGESTION_FAILED,
    SOURCE_ERROR_VECTOR_STORE_FAILED,
    SourceFailure,
    apply_source_failure,
    raise_source_failure,
)


log = get_logger(__name__)


router = APIRouter(prefix="/v1/notebooks/{notebook_id}/outputs", tags=["outputs"])


class OutputGenerateRequest(BaseModel):
    preference: GenerationPreference | None = Field(
        None,
        description="Generation preference: quality prioritizes accuracy, speed prioritizes latency.",
    )
    prompt: str | None = None
    source_ids: list[int] | None = None
    top_k: int = Field(5, ge=1, le=20)
    min_score: float = Field(0.2, ge=0.0, le=1.0)
    model_id: str | None = Field(None, description="Optional model ID to use for generation")

    @field_validator("prompt")
    @classmethod
    def _normalize_prompt(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = " ".join(value.strip().split())
        return cleaned or None

    @model_validator(mode="after")
    def _apply_preference_defaults(self) -> "OutputGenerateRequest":
        if self.preference is None:
            return self

        tuning = tuning_for_preference(self.preference)
        fields_set = self.model_fields_set
        if "top_k" not in fields_set:
            self.top_k = tuning.top_k
        if "min_score" not in fields_set:
            self.min_score = tuning.min_score
        return self


class OutputRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    notebook_id: int
    type: OutputType
    prompt: str | None
    chunk_ids: list[int] | None
    content: JsonDict
    created_at: datetime.datetime
    updated_at: datetime.datetime


@router.post("/{output_type}", response_model=OutputRead, status_code=status.HTTP_201_CREATED)
async def create_output(
    notebook_id: int,
    output_type: OutputType,
    payload: OutputGenerateRequest,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
    cache: CacheProvider = Depends(get_cache_provider),
    embedder=Depends(get_embedding_provider),
    vector_store=Depends(get_vector_store),
    limiters=Depends(get_stage_limiters),
    plugins: PluginRegistry = Depends(get_plugin_registry),
) -> OutputRead:
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")
    if output_type == OutputType.SLIDES:
        raise HTTPException(status_code=400, detail="Use slides endpoints for SLIDES output")

    trace_id = new_trace_id()
    request_id = request.headers.get("x-request-id") or request.headers.get("x-correlation-id") or trace_id
    started = perf_counter()

    raw_payload: object = None
    try:
        raw_payload = await request.json()
    except Exception:
        raw_payload = None

    top_k_provided = isinstance(raw_payload, dict) and "top_k" in raw_payload
    min_score_provided = isinstance(raw_payload, dict) and "min_score" in raw_payload

    tuning = tuning_for_request(output_type, payload.preference)

    effective_top_k = payload.top_k
    effective_min_score = payload.min_score
    if payload.preference is not None:
        if not top_k_provided:
            effective_top_k = tuning.top_k
        if not min_score_provided:
            effective_min_score = tuning.min_score

    deps = StudioDeps(
        settings=settings,
        session=session,
        vector_store=vector_store,
        embedder=embedder,
        cache=cache,
        limiters=limiters,
        plugins=plugins,
    )

    log.info(
        "creating output",
        trace_id=trace_id,
        request_id=request_id,
        notebook_id=notebook_id,
        output_type=output_type.value,
        preference=payload.preference,
        prompt_length=len(payload.prompt) if payload.prompt else 0,
        top_k=effective_top_k,
        min_score=effective_min_score,
        agent_retries=tuning.agent_retries,
        multi_query=tuning.multi_query,
        seed_cap=tuning.multi_query_seed_cap,
        max_chunks_per_source=tuning.max_chunks_per_source,
        token_budget_ratio=tuning.token_budget_ratio,
        model_id=payload.model_id,
    )

    if not payload.source_ids:
        raise HTTPException(status_code=400, detail="source_ids must not be empty")

    try:
        db_output = await run_output_graph(
            notebook_id=notebook_id,
            output_type=output_type,
            prompt=payload.prompt or "",
            deps=deps,
            trace_id=trace_id,
            request_id=request_id,
            preference=payload.preference,
            source_ids=payload.source_ids,
            top_k=effective_top_k,
            min_score=effective_min_score,
            model_id=payload.model_id,
        )
    except ModelConfigurationError as exc:
        log.warning(
            "model configuration error",
            trace_id=trace_id,
            request_id=request_id,
            error_kind="model_error",
            error=str(exc),
        )
        raise HTTPException(
            status_code=503,
            detail=f"AI model configuration error: {exc}. Please check your config/app.yaml settings.",
        ) from exc
    except UnexpectedModelBehavior as exc:
        # pydantic_ai validation errors - model output didn't match expected schema
        error_msg = str(exc)
        log.warning(
            "model output validation failed",
            trace_id=trace_id,
            request_id=request_id,
            error_kind="validation_error",
            error=error_msg,
            output_type=output_type.value,
        )
        # Provide user-friendly message
        if "maximum retries" in error_msg.lower():
            detail = "AI 模型输出格式不符合预期，已达到最大重试次数。请稍后重试或尝试更简单的提示。"
        else:
            detail = f"AI 模型响应异常：{error_msg[:100]}"
        raise HTTPException(status_code=422, detail=detail) from exc
    except ValueError as exc:
        log.warning(
            "invalid request",
            trace_id=trace_id,
            request_id=request_id,
            error_kind="validation_error",
            error=str(exc),
        )
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        log.error(
            "unexpected error during output generation",
            trace_id=trace_id,
            request_id=request_id,
            error_kind="unknown_error",
            exc_info=exc,
        )
        raise HTTPException(
            status_code=500,
            detail="Failed to generate output. Please try again later.",
        ) from exc

    log.info(
        "output created",
        trace_id=trace_id,
        request_id=request_id,
        output_id=db_output.id,
        output_type=output_type.value,
        total_ms=int((perf_counter() - started) * 1000),
    )
    return OutputRead.model_validate(db_output)


@router.get("", response_model=list[OutputRead])
async def list_outputs(
    notebook_id: int,
    session: AsyncSession = Depends(get_db_session),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> list[OutputRead]:
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")

    result = await session.execute(
        select(Output)
        .where(Output.notebook_id == notebook_id)
        .order_by(Output.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return [OutputRead.model_validate(item) for item in result.scalars().all()]


@router.get("/{output_id}", response_model=OutputRead)
async def get_output(
    notebook_id: int,
    output_id: int,
    session: AsyncSession = Depends(get_db_session),
) -> OutputRead:
    output = await session.get(Output, output_id)
    if output is None or output.notebook_id != notebook_id:
        raise HTTPException(status_code=404, detail="Output not found")
    return OutputRead.model_validate(output)


@router.delete("/{output_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_output(
    notebook_id: int,
    output_id: int,
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    """Delete a specific output by ID."""
    output = await session.get(Output, output_id)
    if output is None or output.notebook_id != notebook_id:
        raise HTTPException(status_code=404, detail="Output not found")

    log.info("deleting output", output_id=output_id, notebook_id=notebook_id)
    await session.delete(output)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


class ConvertToSourceResponse(BaseModel):
    source_id: int
    filename: str
    chunk_count: int


def _json_to_text(value: JsonValue | None) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, (int, float, bool)):
        return str(value)
    try:
        return json.dumps(value, ensure_ascii=False)
    except TypeError:
        return str(value)


def _extract_text_from_output(output: Output) -> str:
    """Extract text content from output for source creation."""
    content = output.content
    if not content:
        return output.prompt or ""

    parts: list[str] = []

    # Add title if present
    if "title" in content:
        parts.append(f"# {_json_to_text(content['title'])}")

    # Handle different output types
    output_type = output.type

    if output_type == OutputType.PARAGRAPH:
        if "content" in content:
            paragraph = _json_to_text(content["content"])
            if paragraph:
                parts.append(paragraph)
        elif "text" in content:
            paragraph = _json_to_text(content["text"])
            if paragraph:
                parts.append(paragraph)

    elif output_type == OutputType.BULLETS:
        # Support both the legacy {"bullets": [...]} format and the current
        # BulletsOutput schema {"items": [{"text": ...}, ...]}.
        if "items" in content and isinstance(content["items"], list):
            for item in content["items"]:
                if isinstance(item, str):
                    text = item
                elif isinstance(item, dict):
                    item_dict = cast(JsonDict, item)
                    text = _json_to_text(item_dict.get("text"))
                else:
                    text = _json_to_text(item)
                if text:
                    parts.append(f"- {text}")
        elif "bullets" in content and isinstance(content["bullets"], list):
            for bullet in content["bullets"]:
                if bullet:
                    parts.append(f"- {bullet}")

    elif output_type == OutputType.FAQ:
        if "items" in content and isinstance(content["items"], list):
            for item in content["items"]:
                if not isinstance(item, dict):
                    continue
                item_dict = cast(JsonDict, item)
                q = _json_to_text(item_dict.get("question") or item_dict.get("q"))
                a = _json_to_text(item_dict.get("answer") or item_dict.get("a"))
                if q:
                    parts.append(f"**Q: {q}**")
                if a:
                    parts.append(f"A: {a}")
                parts.append("")

    elif output_type == OutputType.TIMELINE:
        if "events" in content and isinstance(content["events"], list):
            for event in content["events"]:
                if not isinstance(event, dict):
                    continue
                event_dict = cast(JsonDict, event)
                date = _json_to_text(event_dict.get("date"))
                title = _json_to_text(event_dict.get("event") or event_dict.get("title"))
                desc = _json_to_text(event_dict.get("description"))
                parts.append(f"**{date}** - {title}")
                if desc:
                    parts.append(f"  {desc}")

    elif output_type == OutputType.QUIZ:
        if "questions" in content and isinstance(content["questions"], list):
            for i, q in enumerate(content["questions"], 1):
                if not isinstance(q, dict):
                    continue
                q_dict = cast(JsonDict, q)
                question = _json_to_text(q_dict.get("question"))
                parts.append(f"{i}. {question}")
                options = q_dict.get("options")
                if isinstance(options, list):
                    for opt in options:
                        parts.append(f"   - {_json_to_text(opt)}")
                answer = _json_to_text(q_dict.get("answer"))
                if answer:
                    parts.append(f"   答案: {answer}")
                parts.append("")

    elif output_type == OutputType.MINDMAP:
        # Convert mindmap to text outline
        def traverse_node(node: JsonDict, indent: int = 0) -> None:
            label = _json_to_text(node.get("label") or node.get("name"))
            prefix = "  " * indent + ("- " if indent > 0 else "# ")
            parts.append(f"{prefix}{label}")
            children = node.get("children", [])
            if isinstance(children, list):
                for child in children:
                    if isinstance(child, dict):
                        traverse_node(cast(JsonDict, child), indent + 1)

        root = content.get("root") or content
        if isinstance(root, dict):
            traverse_node(cast(JsonDict, root))

    elif output_type == OutputType.GUIDE:
        modules = content.get("modules")
        if isinstance(modules, list):
            for module in modules:
                if not isinstance(module, dict):
                    continue
                module_dict = cast(JsonDict, module)
                title = _json_to_text(module_dict.get("title"))
                if title:
                    parts.append(f"## {title}")
                objective = module_dict.get("objective")
                if isinstance(objective, dict):
                    objective_text = cast(JsonDict, objective).get("text")
                    if objective_text:
                        parts.append(_json_to_text(objective_text))
                key_points = module_dict.get("key_points")
                if isinstance(key_points, list) and key_points:
                    parts.append("")
                    parts.append("### 要点")
                    for point in key_points:
                        if isinstance(point, dict):
                            text = _json_to_text(cast(JsonDict, point).get("text"))
                        else:
                            text = _json_to_text(point)
                        if text:
                            parts.append(f"- {text}")
                parts.append("")
        elif "sections" in content and isinstance(content["sections"], list):
            for section in content["sections"]:
                if not isinstance(section, dict):
                    continue
                section_dict = cast(JsonDict, section)
                title = _json_to_text(section_dict.get("title"))
                if title:
                    parts.append(f"## {title}")
                body = section_dict.get("content") or section_dict.get("body")
                if body:
                    parts.append(_json_to_text(body))
                parts.append("")

    elif output_type == OutputType.BRIEFING:
        sections = content.get("sections")
        if isinstance(sections, list):
            for section in sections:
                if not isinstance(section, dict):
                    continue
                section_dict = cast(JsonDict, section)
                heading = _json_to_text(section_dict.get("heading"))
                if heading:
                    parts.append(f"## {heading}")
                points = section_dict.get("points")
                if isinstance(points, list):
                    for point in points:
                        if isinstance(point, dict):
                            text = _json_to_text(cast(JsonDict, point).get("text"))
                        else:
                            text = _json_to_text(point)
                        if text:
                            parts.append(f"- {text}")
                parts.append("")
        else:
            if "summary" in content:
                parts.append("## 摘要")
                parts.append(_json_to_text(content["summary"]))
            if "key_points" in content and isinstance(content["key_points"], list):
                parts.append("\n## 要点")
                for point in content["key_points"]:
                    parts.append(f"- {_json_to_text(point)}")
            if "recommendations" in content and isinstance(content["recommendations"], list):
                parts.append("\n## 建议")
                for rec in content["recommendations"]:
                    parts.append(f"- {_json_to_text(rec)}")

    elif output_type == OutputType.SLIDES:
        if "markdown" in content and isinstance(content["markdown"], str):
            parts.append(content["markdown"])
        elif "outline" in content and isinstance(content["outline"], dict):
            outline = cast(JsonDict, content["outline"])
            title = _json_to_text(outline.get("title")) or "演示"
            parts.append(f"# {title}")
            slides = outline.get("slides", [])
            if isinstance(slides, list):
                for slide in slides:
                    if not isinstance(slide, dict):
                        continue
                    slide_dict = cast(JsonDict, slide)
                    slide_title = _json_to_text(slide_dict.get("title")) or "幻灯片"
                    parts.append(f"## {slide_title}")
                    bullets = slide_dict.get("bullets")
                    if isinstance(bullets, list):
                        for bullet in bullets:
                            parts.append(f"- {_json_to_text(bullet)}")

    elif output_type == OutputType.STRUCTURED:
        bullets = content.get("bullets")
        if isinstance(bullets, list):
            for bullet in bullets:
                if isinstance(bullet, dict):
                    text = _json_to_text(cast(JsonDict, bullet).get("text"))
                else:
                    text = _json_to_text(bullet)
                if text:
                    parts.append(f"- {text}")
        terms = content.get("terms")
        if isinstance(terms, list) and terms:
            parts.append("")
            parts.append("## 术语")
            for term in terms:
                if term:
                    parts.append(f"- {_json_to_text(term)}")
        sections = content.get("sections")
        if not bullets and isinstance(sections, list):
            for section in sections:
                if not isinstance(section, dict):
                    continue
                section_dict = cast(JsonDict, section)
                title = _json_to_text(section_dict.get("title"))
                if title:
                    parts.append(f"## {title}")
                body = section_dict.get("content")
                if body:
                    parts.append(_json_to_text(body))
        if not parts:
            parts.append(json.dumps(content, ensure_ascii=False, indent=2))

    # Fallback if no parts extracted
    if not parts and content:
        # Try common fields
        for key in ["content", "text", "body", "summary"]:
            value = content.get(key)
            if isinstance(value, str):
                parts.append(value)
                break

    # Add prompt as context if present
    if output.prompt and output.prompt not in "\n".join(parts):
        parts.insert(0, f"> 提示: {output.prompt}\n")

    return "\n\n".join(parts).strip()


def _split_text_to_chunks(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """Split text into chunks for embedding."""
    if not text:
        return []

    # Split by paragraphs first
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

    chunks: list[str] = []
    current_chunk: list[str] = []
    current_length = 0

    for para in paragraphs:
        para_len = len(para)

        if current_length + para_len <= chunk_size:
            current_chunk.append(para)
            current_length += para_len
        else:
            if current_chunk:
                chunks.append("\n\n".join(current_chunk))

            # If paragraph is too long, split by sentences
            if para_len > chunk_size:
                sentences = para.replace(". ", ".\n").replace("。", "。\n").split("\n")
                for sent in sentences:
                    if len(sent) <= chunk_size:
                        chunks.append(sent)
                    else:
                        # Last resort: split by character
                        for i in range(0, len(sent), chunk_size - overlap):
                            chunks.append(sent[i:i + chunk_size])
            else:
                current_chunk = [para]
                current_length = para_len

    if current_chunk:
        chunks.append("\n\n".join(current_chunk))

    return chunks


@router.post("/{output_id}/convert-to-source", response_model=ConvertToSourceResponse, status_code=status.HTTP_201_CREATED)
async def convert_output_to_source(
    notebook_id: int,
    output_id: int,
    session: AsyncSession = Depends(get_db_session),
    cache: CacheProvider = Depends(get_cache_provider),
    embedder: EmbeddingProvider = Depends(get_embedding_provider),
    vector_store: VectorStore = Depends(get_vector_store),
) -> ConvertToSourceResponse:
    """Convert an output to a source document that can be used for RAG queries."""
    output = await session.get(Output, output_id)
    if output is None or output.notebook_id != notebook_id:
        raise HTTPException(status_code=404, detail="Output not found")

    log.info(
        "converting output to source",
        output_id=output_id,
        notebook_id=notebook_id,
        output_type=output.type.value,
    )

    # Extract text from output
    text_content = _extract_text_from_output(output)
    if not text_content:
        raise HTTPException(status_code=400, detail="Output has no content to convert")

    # Generate filename from output type and date
    type_labels = {
        OutputType.FAQ: "常见问题",
        OutputType.GUIDE: "学习指南",
        OutputType.TIMELINE: "时间线",
        OutputType.MINDMAP: "思维导图",
        OutputType.QUIZ: "测验",
        OutputType.BRIEFING: "简报",
        OutputType.SLIDES: "演示",
        OutputType.PARAGRAPH: "段落笔记",
        OutputType.BULLETS: "要点笔记",
        OutputType.STRUCTURED: "结构化笔记",
    }
    type_label = type_labels.get(output.type, "笔记")
    timestamp = output.created_at.strftime("%Y%m%d_%H%M%S")
    filename = f"{type_label}_{timestamp}.md"

    # Create source
    source = Source(
        notebook_id=notebook_id,
        filename=filename,
        mime_type="text/markdown",
        parser_type="text",
        metadata_={
            "converted_from_output": output_id,
            "output_type": output.type.value,
            "word_count": len(text_content.split()),
        },
        status=SourceStatus.PROCESSING,
    )
    session.add(source)
    await session.commit()
    await session.refresh(source)

    try:
        stage = "chunks"
        # Split into chunks
        chunk_texts = _split_text_to_chunks(text_content)
        if not chunk_texts:
            chunk_texts = [text_content]

        # Create embeddings
        stage = "embed"
        embeddings = await embedder.embed_batch(chunk_texts)

        # Create chunks
        stage = "chunks"
        db_chunks: list[Chunk] = []
        for idx, chunk_text in enumerate(chunk_texts):
            chunk = Chunk(
                source_id=source.id,
                chunk_index=idx,
                text=chunk_text,
                metadata_={"source_type": "converted_output"},
            )
            session.add(chunk)
            db_chunks.append(chunk)

        await session.flush()

        # Add to vector store
        stage = "vector_store"
        await vector_store.add(
            notebook_id=notebook_id,
            source_id=source.id,
            chunk_ids=[chunk.id for chunk in db_chunks],
            vectors=embeddings,
        )

        # Update source status
        stage = "commit_ready"
        source.status = SourceStatus.READY
        source.error_code = None
        source.error_message = None
        source.recovery_hint = None
        source.last_error_at = None
        await session.commit()

        log.info(
            "output converted to source",
            output_id=output_id,
            source_id=source.id,
            chunk_count=len(db_chunks),
        )

        await bump_sources_epoch(cache=cache, notebook_id=notebook_id)
        await bump_vector_epoch(cache=cache, notebook_id=notebook_id)

        return ConvertToSourceResponse(
            source_id=source.id,
            filename=filename,
            chunk_count=len(db_chunks),
        )

    except Exception as exc:
        log.error("failed to convert output to source", exc_info=exc)
        if stage != "vector_store":
            await session.rollback()
        if stage == "embed":
            failure = SourceFailure(
                error_code=SOURCE_ERROR_EMBEDDING_FAILED,
                message="转换输出失败：向量嵌入失败",
                recovery_hint="检查 embedding 模型/服务是否可用，或稍后重试。",
                status_code=503,
                details=str(exc)[:512],
            )
        elif stage == "vector_store":
            failure = SourceFailure(
                error_code=SOURCE_ERROR_VECTOR_STORE_FAILED,
                message="转换输出失败：写入向量库失败",
                recovery_hint="检查向量库服务配置与连通性，或稍后重试。",
                status_code=503,
                details=str(exc)[:512],
            )
        else:
            failure = SourceFailure(
                error_code=SOURCE_ERROR_INGESTION_FAILED,
                message="转换输出失败",
                recovery_hint="可稍后重试；若持续失败，检查日志或依赖服务状态。",
                status_code=500,
                details=str(exc)[:512],
            )
        apply_source_failure(source, failure)
        session.add(source)
        await session.commit()
        raise_source_failure(failure)
