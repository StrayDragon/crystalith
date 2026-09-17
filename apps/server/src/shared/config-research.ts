// Research runtime settings (`research:` section) — defaults SSOT, r249
// snake_case governance with a one-time camelCase alias transition, and the
// per-knob accessors used by the research feature.
import type { ModelConfig } from '@crystalith/shared';
import { desc } from '@crystalith/shared';
import { z } from 'zod';

import { config, isRecord } from './config-load.ts';
import { getDefaultChatModel, getModelById } from './config-settings.ts';
import { logger } from './logger.ts';

/**
 * Pre-r249 camelCase research keys → snake_case. Accepted for one transition
 * period with a deprecation warning; remove after the rename has propagated.
 */
const RESEARCH_CAMEL_ALIASES: Record<string, string> = {
  progressEventRetain: 'progress_event_retain',
  parallelBranchUnits: 'parallel_branch_units',
  decomposeModelId: 'decompose_model_id',
  pageRatio: 'page_ratio',
  workUnitMaxSteps: 'work_unit_max_steps',
  nodeChatMaxSteps: 'node_chat_max_steps',
  nodeContentTokenBudget: 'node_content_token_budget',
  nodeSummaryTokenBudget: 'node_summary_token_budget',
  addOnRatio: 'add_on_ratio',
  addOnMinK: 'add_on_min_k',
  addOnMaxK: 'add_on_max_k',
};

const deprecatedResearchKeysWarned = new Set<string>();

function normalizeResearchSection(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) return {};
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    const snake = RESEARCH_CAMEL_ALIASES[key];
    if (snake === undefined) {
      normalized[key] = value;
      continue;
    }
    if (!deprecatedResearchKeysWarned.has(key)) {
      deprecatedResearchKeysWarned.add(key);
      logger.warn(
        `[config] research.${key} is deprecated (r249 snake_case); rename to research.${snake}`,
      );
    }
    normalized[snake] = value;
  }
  return normalized;
}

/**
 * Single source of truth for research defaults (W3): feeds the per-field
 * schema defaults, the RootConfigSchema `research` default, and the
 * parse-failure fallback in getResearchSettings(). Keys are snake_case per
 * configuration-governance r249.
 */
export const RESEARCH_SETTINGS_DEFAULTS = {
  progress_event_retain: 200,
  parallel_branch_units: 2,
  page_ratio: 1.5,
  work_unit_max_steps: 12,
  node_chat_max_steps: 8,
  node_content_token_budget: 32768,
  node_summary_token_budget: 65536,
  add_on_ratio: 0.25,
  add_on_min_k: 5,
  add_on_max_k: 50,
} as const;

export const ResearchSettingsSchema = z.object({
  progress_event_retain: z
    .number()
    .int()
    .positive()
    .default(RESEARCH_SETTINGS_DEFAULTS.progress_event_retain)
    .describe(desc('research.progress_event_retain', '终态后进度账本保留最近 N 条')),
  /**
   * Max concurrent research-node work-units per Run (c106).
   * 1 = serial (behavioral parity with pre-c106 drain); default 2; clamp 1..8.
   */
  parallel_branch_units: z
    .number()
    .int()
    .min(1)
    .max(8)
    .default(RESEARCH_SETTINGS_DEFAULTS.parallel_branch_units)
    .describe(
      desc(
        'research.parallel_branch_units',
        '同一 Run 同时推进的支路 work-unit 上限（1=串行，默认 2，最大 8）',
      ),
    ),
  /** Optional model id for topic decompose planner; omit/empty inherits models.defaults.chat. */
  decompose_model_id: z
    .string()
    .optional()
    .describe(
      desc(
        'research.decompose_model_id',
        '主题自动拆解所用模型 id；省略或空字符串时继承 models.defaults.chat',
      ),
    ),
  /** maxPageFetches = ceil(maxSearches * pageRatio); default 1.5 (c107). */
  page_ratio: z
    .number()
    .positive()
    .default(RESEARCH_SETTINGS_DEFAULTS.page_ratio)
    .describe(desc('research.page_ratio', '读页预算 = ceil(maxSearches × pageRatio)')),
  /** ToolLoopAgent work_unit step cap (c107). */
  work_unit_max_steps: z
    .number()
    .int()
    .positive()
    .default(RESEARCH_SETTINGS_DEFAULTS.work_unit_max_steps)
    .describe(desc('research.work_unit_max_steps', '节点 work_unit 工具环最大步数')),
  /** ToolLoopAgent node_chat step cap (W3; same source as work_unit_max_steps). */
  node_chat_max_steps: z
    .number()
    .int()
    .positive()
    .default(RESEARCH_SETTINGS_DEFAULTS.node_chat_max_steps)
    .describe(desc('research.node_chat_max_steps', '节点对话 agent 单轮工具环最大步数')),
  /** Per-node web evidence content token budget (c107). */
  node_content_token_budget: z
    .number()
    .int()
    .positive()
    .default(RESEARCH_SETTINGS_DEFAULTS.node_content_token_budget)
    .describe(desc('research.node_content_token_budget', '单节点网页正文合计 token 上限')),
  /** Node short-synthesis evidence context token budget (c107). */
  node_summary_token_budget: z
    .number()
    .int()
    .positive()
    .default(RESEARCH_SETTINGS_DEFAULTS.node_summary_token_budget)
    .describe(desc('research.node_summary_token_budget', '节点短综合证据上下文 token 上限')),
  /** Search budget add-on: K = clamp(ceil(maxSearches × ratio), minK, maxK) (c108). */
  add_on_ratio: z
    .number()
    .positive()
    .default(RESEARCH_SETTINGS_DEFAULTS.add_on_ratio)
    .describe(desc('research.add_on_ratio', '检索加购比例：K=ceil(maxSearches×ratio)')),
  add_on_min_k: z
    .number()
    .int()
    .positive()
    .default(RESEARCH_SETTINGS_DEFAULTS.add_on_min_k)
    .describe(desc('research.add_on_min_k', '检索加购块下限')),
  add_on_max_k: z
    .number()
    .int()
    .positive()
    .default(RESEARCH_SETTINGS_DEFAULTS.add_on_max_k)
    .describe(desc('research.add_on_max_k', '检索加购块上限')),
});
export type ResearchSettings = z.infer<typeof ResearchSettingsSchema>;

/** Parsed `research:` section from app.yaml (defaults applied). */
export function getResearchSettings(): ResearchSettings {
  const parsed = ResearchSettingsSchema.safeParse(normalizeResearchSection(config().raw.research));
  return parsed.success ? parsed.data : { ...RESEARCH_SETTINGS_DEFAULTS };
}

/** maxPageFetches = ceil(maxSearches * pageRatio); default ratio 1.5. */
export function getPageRatio(): number {
  const n = getResearchSettings().page_ratio ?? 1.5;
  if (!Number.isFinite(n) || n <= 0) return 1.5;
  return n;
}

/** ToolLoopAgent work_unit step cap (c107). */
export function getWorkUnitMaxSteps(): number {
  const n = getResearchSettings().work_unit_max_steps ?? 12;
  if (!Number.isFinite(n)) return 12;
  return Math.max(1, Math.trunc(n));
}

/** ToolLoopAgent node_chat step cap (W3; same source as getWorkUnitMaxSteps). */
export function getNodeChatMaxSteps(): number {
  const n =
    getResearchSettings().node_chat_max_steps ?? RESEARCH_SETTINGS_DEFAULTS.node_chat_max_steps;
  if (!Number.isFinite(n)) return RESEARCH_SETTINGS_DEFAULTS.node_chat_max_steps;
  return Math.max(1, Math.trunc(n));
}

/** Per-node web evidence content token budget (c107). */
export function getNodeContentTokenBudget(): number {
  const n = getResearchSettings().node_content_token_budget ?? 32768;
  if (!Number.isFinite(n)) return 32768;
  return Math.max(1, Math.trunc(n));
}

/** Node short-synthesis evidence context token budget (c107). */
export function getNodeSummaryTokenBudget(): number {
  const n = getResearchSettings().node_summary_token_budget ?? 65536;
  if (!Number.isFinite(n)) return 65536;
  return Math.max(1, Math.trunc(n));
}

/**
 * Concurrent research-node work-units per Run (c106).
 * Always clamped to 1..8 even if callers bypass Zod.
 */
export function getParallelBranchUnits(): number {
  const n = getResearchSettings().parallel_branch_units ?? 2;
  if (!Number.isFinite(n)) return 2;
  return Math.min(8, Math.max(1, Math.trunc(n)));
}

/**
 * Model for topic auto-decompose planner.
 * Uses `research.decompose_model_id` when set; otherwise inherits default chat.
 */
export function getResearchDecomposeModelConfig(): ModelConfig | undefined {
  const id = getResearchSettings().decompose_model_id?.trim();
  if (id) return getModelById(id) ?? getDefaultChatModel();
  return getDefaultChatModel();
}

/** Search add-on knobs from config (c108). */
export function getSearchAddOnSettings(): {
  addOnRatio: number;
  addOnMinK: number;
  addOnMaxK: number;
} {
  const s = getResearchSettings();
  return {
    addOnRatio: s.add_on_ratio ?? 0.25,
    addOnMinK: s.add_on_min_k ?? 5,
    addOnMaxK: s.add_on_max_k ?? 50,
  };
}
