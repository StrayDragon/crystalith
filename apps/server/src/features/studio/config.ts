// Studio slides config tables — historical origin: v1 slides/config.py
// (deleted in c14). This file is the SSOT now; v2 has no plugin host yet
// (c13 scope), so the tables live here. buildSlidesConfigSchema() produces
// the same PluginConfigSchema shape, so c13 can later relocate the data
// source without changing the /workspace/tools contract.
import type { ConfigOption, SlidesConfigSchema, ThemePresetOption } from '@crystalith/shared';

// ---------------------------------------------------------------------------
// Range tables (v1 config.py:35-45)
// ---------------------------------------------------------------------------

export const QUANTITY_RANGES = {
  short: [6, 8],
  standard: [8, 12],
  detailed: [12, 18],
} as const satisfies Record<string, readonly [number, number]>;

export const DENSITY_BULLETS = {
  sparse: [2, 3],
  standard: [3, 5],
  dense: [5, 7],
} as const satisfies Record<string, readonly [number, number]>;

// ---------------------------------------------------------------------------
// Hint tables (v1 config.py:47-72) — Chinese localized phrases
// ---------------------------------------------------------------------------

export const STRUCTURE_TEMPLATES = {
  standard: '封面 / 议程 / 背景 / 关键发现 / 结论 / 下一步',
  'problem-solution': '背景 / 问题 / 影响 / 方案 / 实施计划 / 收益 / 下一步',
  story: '起点 / 冲突 / 转折 / 洞察 / 行动 / 结尾',
  'project-review': '目标 / 过程 / 结果 / 复盘 / 行动计划',
  training: '目标 / 核心概念 / 示例 / 练习 / 总结',
} as const satisfies Record<string, string>;

export const AUDIENCE_HINTS = {
  general: '通俗易懂，避免过多术语',
  executive: '强调结论与决策要点，简洁直达',
  technical: '保留必要技术细节与定义',
  external: '强调价值与故事性，避免内部术语',
} as const satisfies Record<string, string>;

export const TONE_HINTS = {
  professional: '正式、专业',
  friendly: '亲和、易读',
  inspiring: '鼓舞、强调愿景',
  serious: '严谨、客观',
} as const satisfies Record<string, string>;

export const LANGUAGE_HINTS = {
  zh: '中文',
  en: '英文',
} as const satisfies Record<string, string>;

// ---------------------------------------------------------------------------
// Theme preset templates (v1 config.py:74-123) — verbatim 6-key structure
// ---------------------------------------------------------------------------

export interface ThemePresetTemplate {
  theme: string;
  colorSchema: string;
  fonts: { sans: string; serif: string; mono: string };
  transition: string;
  background: string;
  class: string;
}

export const THEME_PRESET_TEMPLATES: Record<string, ThemePresetTemplate> = {
  'minimal-clean': {
    theme: 'default',
    colorSchema: 'light',
    fonts: { sans: 'Manrope', serif: 'Noto Serif SC', mono: 'Fira Code' },
    transition: 'fade',
    background: '#F8FAFC',
    class: 'text-left',
  },
  'business-brief': {
    theme: 'default',
    colorSchema: 'light',
    fonts: { sans: 'IBM Plex Sans', serif: 'Noto Serif SC', mono: 'JetBrains Mono' },
    transition: 'slide-left',
    background: 'linear-gradient(180deg, #F8FAFC 0%, #EEF2FF 100%)',
    class: 'text-left',
  },
  'product-launch': {
    theme: 'default',
    colorSchema: 'light',
    fonts: { sans: 'Space Grotesk', serif: 'Noto Serif SC', mono: 'Fira Code' },
    transition: 'fade-out',
    background: 'radial-gradient(circle at 20% 20%, #FDE68A 0%, #FFFFFF 45%, #EEF2FF 100%)',
    class: 'text-center',
  },
  'research-paper': {
    theme: 'default',
    colorSchema: 'light',
    fonts: { sans: 'Source Sans 3', serif: 'Source Serif 4', mono: 'Source Code Pro' },
    transition: 'slide-up',
    background: '#FFFBF5',
    class: 'text-left',
  },
  'data-insight': {
    theme: 'default',
    colorSchema: 'light',
    fonts: { sans: 'Inter', serif: 'Noto Serif SC', mono: 'JetBrains Mono' },
    transition: 'slide-right',
    background: 'repeating-linear-gradient(0deg, #F8FAFC 0px, #F8FAFC 24px, #E5E7EB 25px)',
    class: 'text-left',
  },
  'creative-visual': {
    theme: 'default',
    colorSchema: 'dark',
    fonts: { sans: 'Bebas Neue', serif: 'Noto Serif SC', mono: 'Fira Code' },
    transition: 'zoom',
    background: 'linear-gradient(135deg, #0F172A 0%, #111827 50%, #1F2937 100%)',
    class: 'text-white text-left',
  },
};

// ---------------------------------------------------------------------------
// DEFAULT_CONFIG (v1 config.py:24-33)
// ---------------------------------------------------------------------------

export const DEFAULT_CONFIG = {
  quantity: 'standard',
  audience: 'general',
  structure: 'standard',
  tone: 'professional',
  language: 'zh',
  density: 'standard',
  themePreset: 'minimal-clean',
  frontmatter: '',
} as const;

// ---------------------------------------------------------------------------
// OPTIONS lists (v1 config.py:125-195) — for the frontend config UI
// ---------------------------------------------------------------------------

export const QUANTITY_OPTIONS: ConfigOption[] = [
  { id: 'short', label: '精简（6-8）', isDefault: false },
  { id: 'standard', label: '标准（8-12）', isDefault: true },
  { id: 'detailed', label: '详尽（12-18）', isDefault: false },
];

export const AUDIENCE_OPTIONS: ConfigOption[] = [
  { id: 'general', label: '通用受众', isDefault: true },
  { id: 'executive', label: '管理层', isDefault: false },
  { id: 'technical', label: '技术受众', isDefault: false },
  { id: 'external', label: '外部受众', isDefault: false },
];

export const STRUCTURE_OPTIONS: ConfigOption[] = [
  { id: 'standard', label: '通用结构', isDefault: true },
  { id: 'problem-solution', label: '问题/方案', isDefault: false },
  { id: 'story', label: '故事叙事', isDefault: false },
  { id: 'project-review', label: '项目复盘', isDefault: false },
  { id: 'training', label: '培训课程', isDefault: false },
];

export const TONE_OPTIONS: ConfigOption[] = [
  { id: 'professional', label: '正式专业', isDefault: true },
  { id: 'friendly', label: '亲和易读', isDefault: false },
  { id: 'inspiring', label: '鼓舞愿景', isDefault: false },
  { id: 'serious', label: '严谨客观', isDefault: false },
];

export const LANGUAGE_OPTIONS: ConfigOption[] = [
  { id: 'zh', label: '中文', isDefault: true },
  { id: 'en', label: '英文', isDefault: false },
];

export const DENSITY_OPTIONS: ConfigOption[] = [
  { id: 'sparse', label: '稀疏（2-3 要点）', isDefault: false },
  { id: 'standard', label: '标准（3-5 要点）', isDefault: true },
  { id: 'dense', label: '密集（5-7 要点）', isDefault: false },
];

function themeTemplateJson(id: keyof typeof THEME_PRESET_TEMPLATES): Record<string, unknown> {
  return { ...THEME_PRESET_TEMPLATES[id] };
}

export const THEME_PRESET_OPTIONS: ThemePresetOption[] = (
  [
    ['minimal-clean', '清爽极简'],
    ['business-brief', '商务汇报'],
    ['product-launch', '产品发布'],
    ['research-paper', '学术研究'],
    ['data-insight', '数据洞察'],
    ['creative-visual', '创意视觉'],
  ] as const
).map(([id, label]) => ({
  id,
  label,
  template: themeTemplateJson(id),
}));

// ---------------------------------------------------------------------------
// Resolver helpers (v1 generator.py:67-99) — fallback to standard/general
// ---------------------------------------------------------------------------

export function resolveQuantityRange(quantity?: string | null): [number, number] {
  for (const [id, range] of Object.entries(QUANTITY_RANGES)) {
    if (id === quantity) return [range[0], range[1]];
  }
  return [QUANTITY_RANGES.standard[0], QUANTITY_RANGES.standard[1]];
}

export function resolveBulletRange(density?: string | null): [number, number] {
  for (const [id, range] of Object.entries(DENSITY_BULLETS)) {
    if (id === density) return [range[0], range[1]];
  }
  return [DENSITY_BULLETS.standard[0], DENSITY_BULLETS.standard[1]];
}

export function resolveStructureHint(structure?: string | null): string | undefined {
  for (const [id, hint] of Object.entries(STRUCTURE_TEMPLATES)) {
    if (id === structure) return hint;
  }
  return undefined;
}

export function resolveAudienceHint(audience?: string | null): string | undefined {
  for (const [id, hint] of Object.entries(AUDIENCE_HINTS)) {
    if (id === audience) return hint;
  }
  return undefined;
}

export function resolveToneHint(tone?: string | null): string | undefined {
  for (const [id, hint] of Object.entries(TONE_HINTS)) {
    if (id === tone) return hint;
  }
  return undefined;
}

export function resolveLanguageHint(language?: string | null): string | undefined {
  for (const [id, hint] of Object.entries(LANGUAGE_HINTS)) {
    if (id === language) return hint;
  }
  return undefined;
}

export function resolveThemePreset(preset?: string | null): string {
  return preset && preset in THEME_PRESET_TEMPLATES ? preset : 'minimal-clean';
}

// ---------------------------------------------------------------------------
// buildSlidesConfigSchema — the shape consumed by /workspace/tools (r20)
// ---------------------------------------------------------------------------

export function buildSlidesConfigSchema(): SlidesConfigSchema {
  return {
    defaults: { ...DEFAULT_CONFIG },
    quantityOptions: QUANTITY_OPTIONS,
    difficultyOptions: [],
    audienceOptions: AUDIENCE_OPTIONS,
    structureOptions: STRUCTURE_OPTIONS,
    toneOptions: TONE_OPTIONS,
    languageOptions: LANGUAGE_OPTIONS,
    densityOptions: DENSITY_OPTIONS,
    themePresetOptions: THEME_PRESET_OPTIONS,
    topicPlaceholder: '输入演示主题…',
    supportsTopic: true,
    engine: 'slidev',
    // c56: preview descriptor tells frontend where to open slide preview
    // (v1 SlidevSlidesWorkflowPlugin.preview_descriptor)
    preview: {
      kind: 'external_url',
      service: 'slidev',
      meta: { package: '@crystalith-slidev' },
    },
  };
}

// ---------------------------------------------------------------------------
// preference → retrieval params (v1 generation_preference.py SLIDES tuning)
// v1 subtlety: preference=None uses module constants (8/0.2), NOT DEFAULT_TUNING.
// ---------------------------------------------------------------------------

export interface RetrievalTuning {
  topK: number;
  minScore: number;
}

const DEFAULT_TOP_K = 8;
const DEFAULT_MIN_SCORE = 0.2;

const SLIDES_TUNING = {
  quality: { topK: 12, minScore: 0.1 },
  speed: { topK: 6, minScore: 0.22 },
} as const satisfies Record<string, RetrievalTuning>;

export function resolveRetrievalTuning(preference?: string | null): RetrievalTuning {
  for (const [id, tuning] of Object.entries(SLIDES_TUNING)) {
    if (id === preference) return tuning;
  }
  return { topK: DEFAULT_TOP_K, minScore: DEFAULT_MIN_SCORE };
}
