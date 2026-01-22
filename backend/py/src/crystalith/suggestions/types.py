from __future__ import annotations

from cl_stdx.enumx import MetaInfoStrEnum, XMetaInfo


class SuggestionType(MetaInfoStrEnum):
    """Types of question suggestions."""

    FACTUAL = "factual", XMetaInfo(description="事实性问题", display_text="事实")
    ANALYTICAL = "analytical", XMetaInfo(description="分析性问题", display_text="分析")
    COMPARATIVE = "comparative", XMetaInfo(description="比较性问题", display_text="比较")
    CREATIVE = "creative", XMetaInfo(description="创意性问题", display_text="创意")
    DEEP_DIVE = "deep_dive", XMetaInfo(description="深入探索问题", display_text="深入")
