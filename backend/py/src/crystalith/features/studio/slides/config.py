from __future__ import annotations

from dataclasses import dataclass

from .schemas import SlideGenerationConfig
from crystalith.shared.json_types import JsonDict


@dataclass(frozen=True, slots=True)
class SlidesOption:
    id: str
    label: str
    is_default: bool = False


@dataclass(frozen=True, slots=True)
class SlidesThemePreset:
    id: str
    label: str
    template: JsonDict


DEFAULT_CONFIG = SlideGenerationConfig(
    quantity="standard",
    audience="general",
    structure="standard",
    tone="professional",
    language="zh",
    density="standard",
    theme_preset="minimal-clean",
    frontmatter="",
)

QUANTITY_RANGES: dict[str, tuple[int, int]] = {
    "short": (6, 8),
    "standard": (8, 12),
    "detailed": (12, 18),
}

DENSITY_BULLETS: dict[str, tuple[int, int]] = {
    "sparse": (2, 3),
    "standard": (3, 5),
    "dense": (5, 7),
}

STRUCTURE_TEMPLATES: dict[str, str] = {
    "standard": "封面 / 议程 / 背景 / 关键发现 / 结论 / 下一步",
    "problem-solution": "背景 / 问题 / 影响 / 方案 / 实施计划 / 收益 / 下一步",
    "story": "起点 / 冲突 / 转折 / 洞察 / 行动 / 结尾",
    "project-review": "目标 / 过程 / 结果 / 复盘 / 行动计划",
    "training": "目标 / 核心概念 / 示例 / 练习 / 总结",
}

AUDIENCE_HINTS: dict[str, str] = {
    "general": "通俗易懂，避免过多术语",
    "executive": "强调结论与决策要点，简洁直达",
    "technical": "保留必要技术细节与定义",
    "external": "强调价值与故事性，避免内部术语",
}

TONE_HINTS: dict[str, str] = {
    "professional": "正式、专业",
    "friendly": "亲和、易读",
    "inspiring": "鼓舞、强调愿景",
    "serious": "严谨、客观",
}

LANGUAGE_HINTS: dict[str, str] = {
    "zh": "中文",
    "en": "英文",
}

THEME_PRESET_TEMPLATES: dict[str, JsonDict] = {
    "minimal-clean": {
        "theme": "default",
        "colorSchema": "light",
        "fonts": {"sans": "Manrope", "serif": "Noto Serif SC", "mono": "Fira Code"},
        "transition": "fade",
        "background": "#F8FAFC",
        "class": "text-left",
    },
    "business-brief": {
        "theme": "default",
        "colorSchema": "light",
        "fonts": {"sans": "IBM Plex Sans", "serif": "Noto Serif SC", "mono": "JetBrains Mono"},
        "transition": "slide-left",
        "background": "linear-gradient(180deg, #F8FAFC 0%, #EEF2FF 100%)",
        "class": "text-left",
    },
    "product-launch": {
        "theme": "default",
        "colorSchema": "light",
        "fonts": {"sans": "Space Grotesk", "serif": "Noto Serif SC", "mono": "Fira Code"},
        "transition": "fade-out",
        "background": "radial-gradient(circle at 20% 20%, #FDE68A 0%, #FFFFFF 45%, #EEF2FF 100%)",
        "class": "text-center",
    },
    "research-paper": {
        "theme": "default",
        "colorSchema": "light",
        "fonts": {"sans": "Source Sans 3", "serif": "Source Serif 4", "mono": "Source Code Pro"},
        "transition": "slide-up",
        "background": "#FFFBF5",
        "class": "text-left",
    },
    "data-insight": {
        "theme": "default",
        "colorSchema": "light",
        "fonts": {"sans": "Inter", "serif": "Noto Serif SC", "mono": "JetBrains Mono"},
        "transition": "slide-right",
        "background": "repeating-linear-gradient(0deg, #F8FAFC 0px, #F8FAFC 24px, #E5E7EB 25px)",
        "class": "text-left",
    },
    "creative-visual": {
        "theme": "default",
        "colorSchema": "dark",
        "fonts": {"sans": "Bebas Neue", "serif": "Noto Serif SC", "mono": "Fira Code"},
        "transition": "zoom",
        "background": "linear-gradient(135deg, #0F172A 0%, #111827 50%, #1F2937 100%)",
        "class": "text-white text-left",
    },
}

QUANTITY_OPTIONS = [
    SlidesOption(id="short", label="精简（6-8）", is_default=DEFAULT_CONFIG.quantity == "short"),
    SlidesOption(id="standard", label="标准（8-12）", is_default=DEFAULT_CONFIG.quantity == "standard"),
    SlidesOption(id="detailed", label="详尽（12-18）", is_default=DEFAULT_CONFIG.quantity == "detailed"),
]

AUDIENCE_OPTIONS = [
    SlidesOption(id="general", label="通用受众", is_default=DEFAULT_CONFIG.audience == "general"),
    SlidesOption(id="executive", label="管理层", is_default=DEFAULT_CONFIG.audience == "executive"),
    SlidesOption(id="technical", label="技术受众", is_default=DEFAULT_CONFIG.audience == "technical"),
    SlidesOption(id="external", label="外部受众", is_default=DEFAULT_CONFIG.audience == "external"),
]

STRUCTURE_OPTIONS = [
    SlidesOption(id="standard", label="通用结构", is_default=DEFAULT_CONFIG.structure == "standard"),
    SlidesOption(id="problem-solution", label="问题/方案", is_default=DEFAULT_CONFIG.structure == "problem-solution"),
    SlidesOption(id="story", label="故事叙事", is_default=DEFAULT_CONFIG.structure == "story"),
    SlidesOption(id="project-review", label="项目复盘", is_default=DEFAULT_CONFIG.structure == "project-review"),
    SlidesOption(id="training", label="培训课程", is_default=DEFAULT_CONFIG.structure == "training"),
]

TONE_OPTIONS = [
    SlidesOption(id="professional", label="正式专业", is_default=DEFAULT_CONFIG.tone == "professional"),
    SlidesOption(id="friendly", label="亲和易读", is_default=DEFAULT_CONFIG.tone == "friendly"),
    SlidesOption(id="inspiring", label="鼓舞愿景", is_default=DEFAULT_CONFIG.tone == "inspiring"),
    SlidesOption(id="serious", label="严谨客观", is_default=DEFAULT_CONFIG.tone == "serious"),
]

LANGUAGE_OPTIONS = [
    SlidesOption(id="zh", label="中文", is_default=DEFAULT_CONFIG.language == "zh"),
    SlidesOption(id="en", label="英文", is_default=DEFAULT_CONFIG.language == "en"),
]

DENSITY_OPTIONS = [
    SlidesOption(id="sparse", label="稀疏（2-3 要点）", is_default=DEFAULT_CONFIG.density == "sparse"),
    SlidesOption(id="standard", label="标准（3-5 要点）", is_default=DEFAULT_CONFIG.density == "standard"),
    SlidesOption(id="dense", label="密集（5-7 要点）", is_default=DEFAULT_CONFIG.density == "dense"),
]

THEME_PRESET_OPTIONS = [
    SlidesThemePreset(
        id="minimal-clean",
        label="清爽极简",
        template=THEME_PRESET_TEMPLATES["minimal-clean"],
    ),
    SlidesThemePreset(
        id="business-brief",
        label="商务汇报",
        template=THEME_PRESET_TEMPLATES["business-brief"],
    ),
    SlidesThemePreset(
        id="product-launch",
        label="产品发布",
        template=THEME_PRESET_TEMPLATES["product-launch"],
    ),
    SlidesThemePreset(
        id="research-paper",
        label="学术研究",
        template=THEME_PRESET_TEMPLATES["research-paper"],
    ),
    SlidesThemePreset(
        id="data-insight",
        label="数据洞察",
        template=THEME_PRESET_TEMPLATES["data-insight"],
    ),
    SlidesThemePreset(
        id="creative-visual",
        label="创意视觉",
        template=THEME_PRESET_TEMPLATES["creative-visual"],
    ),
]
