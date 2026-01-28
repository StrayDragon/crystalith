from __future__ import annotations

import datetime
import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic_ai.exceptions import UnexpectedModelBehavior
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from cl_logs.logging import get_logger

from crystalith.shared.agents.deps import StudioDeps
from crystalith.shared.agents.models import ModelConfigurationError
from crystalith.shared.agents.output_graph import run_output_graph
from crystalith.shared.ai.interfaces import EmbeddingProvider
from crystalith.shared.config import Settings
from crystalith.shared.db import Chunk, Notebook, Output, Source
from crystalith.shared.types import OutputType, SourceStatus
from crystalith.shared.vector_storage import VectorStore

from crystalith.shared.deps import get_db_session, get_embedding_provider, get_settings, get_vector_store


log = get_logger(__name__)


router = APIRouter(prefix="/v1/notebooks/{notebook_id}/outputs", tags=["outputs"])


class OutputGenerateRequest(BaseModel):
    prompt: str | None = None
    chunk_ids: list[int] | None = None
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


class OutputRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    notebook_id: int
    type: OutputType
    prompt: str | None
    chunk_ids: list[int] | None
    content: dict[str, Any]
    created_at: datetime.datetime
    updated_at: datetime.datetime


@router.post("/{output_type}", response_model=OutputRead, status_code=status.HTTP_201_CREATED)
async def create_output(
    notebook_id: int,
    output_type: OutputType,
    payload: OutputGenerateRequest,
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
    embedder=Depends(get_embedding_provider),
    vector_store=Depends(get_vector_store),
) -> OutputRead:
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")
    if output_type == OutputType.SLIDES:
        raise HTTPException(status_code=400, detail="Use slides endpoints for SLIDES output")

    deps = StudioDeps(
        settings=settings,
        session=session,
        vector_store=vector_store,
        embedder=embedder,
    )

    log.info(
        "creating output",
        notebook_id=notebook_id,
        output_type=output_type.value,
        prompt_length=len(payload.prompt) if payload.prompt else 0,
        chunk_ids_count=len(payload.chunk_ids) if payload.chunk_ids else 0,
        model_id=payload.model_id,
    )

    try:
        db_output = await run_output_graph(
            notebook_id=notebook_id,
            output_type=output_type,
            prompt=payload.prompt or "",
            deps=deps,
            chunk_ids=payload.chunk_ids,
            top_k=payload.top_k,
            min_score=payload.min_score,
            model_id=payload.model_id,
        )
    except ModelConfigurationError as exc:
        log.warning("model configuration error", error=str(exc))
        raise HTTPException(
            status_code=503,
            detail=f"AI model configuration error: {exc}. Please check your config/app.yaml settings.",
        ) from exc
    except UnexpectedModelBehavior as exc:
        # pydantic_ai validation errors - model output didn't match expected schema
        error_msg = str(exc)
        log.warning(
            "model output validation failed",
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
        log.warning("invalid request", error=str(exc))
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        log.error("unexpected error during output generation", exc_info=exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to generate output. Please try again later.",
        ) from exc

    log.info("output created", output_id=db_output.id, output_type=output_type.value)
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


def _extract_text_from_output(output: Output) -> str:
    """Extract text content from output for source creation."""
    content = output.content
    if not content:
        return output.prompt or ""

    parts: list[str] = []

    # Add title if present
    if "title" in content:
        parts.append(f"# {content['title']}")

    # Handle different output types
    output_type = output.type

    if output_type == OutputType.PARAGRAPH:
        if "content" in content:
            parts.append(content["content"])
        elif "text" in content:
            parts.append(content["text"])

    elif output_type == OutputType.BULLETS:
        if "bullets" in content and isinstance(content["bullets"], list):
            for bullet in content["bullets"]:
                parts.append(f"- {bullet}")

    elif output_type == OutputType.FAQ:
        if "items" in content and isinstance(content["items"], list):
            for item in content["items"]:
                q = item.get("question", item.get("q", ""))
                a = item.get("answer", item.get("a", ""))
                if q:
                    parts.append(f"**Q: {q}**")
                if a:
                    parts.append(f"A: {a}")
                parts.append("")

    elif output_type == OutputType.TIMELINE:
        if "events" in content and isinstance(content["events"], list):
            for event in content["events"]:
                date = event.get("date", "")
                title = event.get("title", "")
                desc = event.get("description", "")
                parts.append(f"**{date}** - {title}")
                if desc:
                    parts.append(f"  {desc}")

    elif output_type == OutputType.QUIZ:
        if "questions" in content and isinstance(content["questions"], list):
            for i, q in enumerate(content["questions"], 1):
                question = q.get("question", "")
                parts.append(f"{i}. {question}")
                options = q.get("options", [])
                for opt in options:
                    parts.append(f"   - {opt}")
                answer = q.get("answer", "")
                if answer:
                    parts.append(f"   答案: {answer}")
                parts.append("")

    elif output_type == OutputType.MINDMAP:
        # Convert mindmap to text outline
        def traverse_node(node: dict, indent: int = 0) -> None:
            label = node.get("label", node.get("name", ""))
            prefix = "  " * indent + ("- " if indent > 0 else "# ")
            parts.append(f"{prefix}{label}")
            children = node.get("children", [])
            for child in children:
                traverse_node(child, indent + 1)

        root = content.get("root") or content
        if isinstance(root, dict):
            traverse_node(root)

    elif output_type == OutputType.GUIDE:
        if "sections" in content and isinstance(content["sections"], list):
            for section in content["sections"]:
                title = section.get("title", "")
                if title:
                    parts.append(f"## {title}")
                body = section.get("content", section.get("body", ""))
                if body:
                    parts.append(body)
                parts.append("")

    elif output_type == OutputType.BRIEFING:
        if "summary" in content:
            parts.append("## 摘要")
            parts.append(content["summary"])
        if "key_points" in content and isinstance(content["key_points"], list):
            parts.append("\n## 要点")
            for point in content["key_points"]:
                parts.append(f"- {point}")
        if "recommendations" in content and isinstance(content["recommendations"], list):
            parts.append("\n## 建议")
            for rec in content["recommendations"]:
                parts.append(f"- {rec}")

    elif output_type == OutputType.SLIDES:
        if "markdown" in content and isinstance(content["markdown"], str):
            parts.append(content["markdown"])
        elif "outline" in content and isinstance(content["outline"], dict):
            outline = content["outline"]
            title = outline.get("title") or "演示"
            parts.append(f"# {title}")
            slides = outline.get("slides", [])
            if isinstance(slides, list):
                for slide in slides:
                    if not isinstance(slide, dict):
                        continue
                    slide_title = slide.get("title") or "幻灯片"
                    parts.append(f"## {slide_title}")
                    bullets = slide.get("bullets", [])
                    if isinstance(bullets, list):
                        for bullet in bullets:
                            parts.append(f"- {bullet}")

    elif output_type == OutputType.STRUCTURED:
        # Generic structured content
        if "sections" in content:
            for section in content["sections"]:
                title = section.get("title", "")
                if title:
                    parts.append(f"## {title}")
                body = section.get("content", "")
                if body:
                    parts.append(body)
        else:
            # Fallback: serialize as readable text
            parts.append(json.dumps(content, ensure_ascii=False, indent=2))

    # Fallback if no parts extracted
    if not parts and content:
        # Try common fields
        for key in ["content", "text", "body", "summary"]:
            if key in content and isinstance(content[key], str):
                parts.append(content[key])
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
        # Split into chunks
        chunk_texts = _split_text_to_chunks(text_content)
        if not chunk_texts:
            chunk_texts = [text_content]

        # Create embeddings
        embeddings = await embedder.embed(chunk_texts)

        # Create chunks
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
        await vector_store.add(
            notebook_id=notebook_id,
            source_id=source.id,
            chunk_ids=[chunk.id for chunk in db_chunks],
            vectors=embeddings,
        )

        # Update source status
        source.status = SourceStatus.READY
        await session.commit()

        log.info(
            "output converted to source",
            output_id=output_id,
            source_id=source.id,
            chunk_count=len(db_chunks),
        )

        return ConvertToSourceResponse(
            source_id=source.id,
            filename=filename,
            chunk_count=len(db_chunks),
        )

    except Exception as exc:
        log.error("failed to convert output to source", exc_info=exc)
        source.status = SourceStatus.FAILED
        source.error_message = str(exc)[:500]
        await session.commit()
        raise HTTPException(
            status_code=500,
            detail="Failed to convert output to source. Please try again.",
        ) from exc
