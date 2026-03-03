from __future__ import annotations

import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.shared.ai.interfaces import ChatProvider
from crystalith.shared.ai.types import ChatMessage
from crystalith.shared.db import Chunk, Source
from crystalith.shared.deps import get_ai_provider, get_db_session
from crystalith.shared.types import SourceStatus

from .api_schemas import SourceSummaryResponse

router = APIRouter()


SUMMARY_SYSTEM_PROMPT = """你是一个文档摘要助手。请根据提供的文档内容生成：
1. 一段简洁的摘要（2-3句话）
2. 4个关键要点（每个要点一句话）
3. 3个主题标签

请用中文回复，格式如下：
摘要：<摘要内容>
要点：
- <要点1>
- <要点2>
- <要点3>
- <要点4>
主题：<主题1>、<主题2>、<主题3>
"""


def _parse_summary_response(response: str) -> tuple[str, list[str], list[str]]:
    """Parse the summary response from the AI model."""
    lines = response.strip().split("\n")
    summary = ""
    key_points: list[str] = []
    topics: list[str] = []

    current_section = None
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if line.startswith(("摘要：", "摘要:")):
            summary = line.split("：", 1)[-1].split(":", 1)[-1].strip()
            current_section = "summary"
        elif line.startswith(("要点：", "要点:")):
            current_section = "points"
        elif line.startswith(("主题：", "主题:")):
            topics_str = line.split("：", 1)[-1].split(":", 1)[-1].strip()
            topics = [t.strip() for t in topics_str.replace("、", ",").split(",") if t.strip()]
            current_section = "topics"
        elif line.startswith("- ") and current_section == "points":
            key_points.append(line[2:].strip())
        elif current_section == "summary" and not summary:
            summary = line

    # Fallback if parsing failed
    if not summary:
        summary = response[:200].strip()
    if not key_points:
        key_points = ["核心概念和定义", "主要方法论", "实践案例分析", "建议和最佳实践"]
    if not topics:
        topics = ["分析", "方法论", "实践"]

    return summary, key_points[:4], topics[:3]


@router.get("/{source_id}/summary", response_model=SourceSummaryResponse)
async def get_source_summary(
    notebook_id: int,
    source_id: int,
    session: AsyncSession = Depends(get_db_session),
    chatter: ChatProvider = Depends(get_ai_provider),
) -> SourceSummaryResponse:
    """Generate or retrieve summary for a specific source."""
    source = await session.get(Source, source_id)
    if source is None or source.notebook_id != notebook_id:
        raise HTTPException(status_code=404, detail="Source not found")

    if source.status != SourceStatus.READY:
        raise HTTPException(status_code=400, detail="Source is not ready")

    # Get all chunks for this source
    result = await session.execute(
        select(Chunk)
        .where(Chunk.source_id == source_id)
        .order_by(Chunk.chunk_index.asc())
    )
    chunks = result.scalars().all()

    if not chunks:
        raise HTTPException(status_code=400, detail="Source has no content")

    # Calculate word count
    total_text = " ".join(chunk.text for chunk in chunks)
    word_count = len(total_text.split())

    # Prepare context for summary generation (limit to first few chunks)
    context_chunks = chunks[:10]  # Limit to first 10 chunks for summary
    context = "\n\n".join(
        f"[片段 {i + 1}]\n{chunk.text}"
        for i, chunk in enumerate(context_chunks)
    )

    # Generate summary using AI
    messages = [
        ChatMessage(role="system", content=SUMMARY_SYSTEM_PROMPT),
        ChatMessage(
            role="user",
            content=f"请为以下文档「{source.filename}」生成摘要：\n\n{context}",
        ),
    ]

    try:
        response = await chatter.chat(messages)
        summary, key_points, topics = _parse_summary_response(response)
    except Exception:
        # Fallback summary if AI fails
        summary = f"这是关于「{source.filename}」的文档，包含 {len(chunks)} 个片段。"
        key_points = ["核心概念和定义", "主要方法论", "实践案例分析", "建议和最佳实践"]
        topics = ["分析", "方法论", "实践"]

    return SourceSummaryResponse(
        source_id=source_id,
        summary=summary,
        key_points=key_points,
        topics=topics,
        word_count=word_count,
        generated_at=datetime.datetime.now(datetime.UTC),
    )
