// Deep Research (ResearchRun) wire schemas.
// SSOT for HTTP / Eden / OpenAPI. FE Desk consumes these via Eden.
import { z } from 'zod';

import { IdSchema, IsoTimestampSchema, PaginationParamsSchema } from './common.js';
import { desc } from './i18n.js';

// ---------------------------------------------------------------------------
// Enums / primitives
// ---------------------------------------------------------------------------

export const ResearchRunStatusSchema = z
  .enum(['queued', 'running', 'awaiting_confirm', 'completed', 'failed', 'cancelled'])
  .openapi({ description: desc('research.status', '研究任务状态') });
export type ResearchRunStatus = z.infer<typeof ResearchRunStatusSchema>;

export const ResearchDepthSchema = z
  .enum(['shallow', 'medium', 'deep'])
  .openapi({ description: desc('research.depth', '研究深度') });
export type ResearchDepth = z.infer<typeof ResearchDepthSchema>;

export const ResearchConclusionStatusSchema = z.enum([
  'clear',
  'partial',
  'missing',
  'pending',
  'pruned',
]);
export type ResearchConclusionStatus = z.infer<typeof ResearchConclusionStatusSchema>;

export const ResearchNodePhaseSchema = z.enum(['idle', 'retrieving', 'synthesizing']);
export type ResearchNodePhase = z.infer<typeof ResearchNodePhaseSchema>;

export const ResearchNodeRoleSchema = z.enum(['question', 'research', 'conclusion']).openapi({
  description: desc('research.node_role', '研究图节点角色（question / research / conclusion）'),
});
export type ResearchNodeRole = z.infer<typeof ResearchNodeRoleSchema>;

export const ResearchLlmActivitySchema = z
  .enum(['work_unit', 'node_chat'])
  .openapi({ description: desc('research.llm_activity', '同 Run LLM 互斥活动指针') });
export type ResearchLlmActivity = z.infer<typeof ResearchLlmActivitySchema>;

export const ResearchEdgeKindSchema = z.enum([
  'decompose',
  'expand',
  'focus',
  'filter',
  'compare',
  'refine',
  'support',
  'fork',
  'merge',
]);
export type ResearchEdgeKind = z.infer<typeof ResearchEdgeKindSchema>;

/** L1 depth → budget mapping (design §14). */
export const RESEARCH_DEPTH_BUDGETS = {
  shallow: { maxSearches: 8, maxNodes: 12 },
  medium: { maxSearches: 20, maxNodes: 30 },
  deep: { maxSearches: 40, maxNodes: 60 },
} as const satisfies Record<ResearchDepth, { maxSearches: number; maxNodes: number }>;

// ---------------------------------------------------------------------------
// Graph
// ---------------------------------------------------------------------------

export const ResearchNodeSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .openapi({ description: desc('research.node_id', '研究图节点 ID') }),
    title: z.string().openapi({ description: desc('research.node_title', '节点标题') }),
    role: ResearchNodeRoleSchema.optional().openapi({
      description: desc(
        'research.node_role_field',
        '节点角色；缺省时回退 id 前缀 node_root_ / node_conclusion_',
      ),
    }),
    query: z
      .string()
      .optional()
      .openapi({ description: desc('research.query', '研究查询语句') }),
    summary: z
      .string()
      .optional()
      .openapi({ description: desc('research.node_summary', '节点摘要') }),
    conclusionStatus: ResearchConclusionStatusSchema.openapi({
      description: desc('research.conclusion_status', '节点结论状态'),
    }),
    phase: ResearchNodePhaseSchema.optional().openapi({
      description: desc('research.node_phase', '节点执行阶段'),
    }),
    evidenceIds: z
      .array(z.string())
      .optional()
      .openapi({ description: desc('research.evidence_ids', '节点关联证据 ID 列表') }),
  })
  .openapi({ description: desc('research.node', '研究图节点') });
export type ResearchNode = z.infer<typeof ResearchNodeSchema>;

export const ResearchEdgeSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .openapi({ description: desc('research.edge_id', '研究图边 ID') }),
    source: z
      .string()
      .min(1)
      .openapi({ description: desc('research.edge_source', '边起点节点 ID') }),
    target: z
      .string()
      .min(1)
      .openapi({ description: desc('research.edge_target', '边终点节点 ID') }),
    kind: ResearchEdgeKindSchema.openapi({
      description: desc('research.edge_kind', '边类型（闭集）'),
    }),
    labelNote: z
      .string()
      .optional()
      .openapi({ description: desc('research.edge_label_note', '边注释') }),
  })
  .openapi({ description: desc('research.edge', '研究图边') });
export type ResearchEdge = z.infer<typeof ResearchEdgeSchema>;

export const ResearchGraphPatchSchema = z
  .object({
    nodes: z.array(ResearchNodeSchema).optional(),
    edges: z.array(ResearchEdgeSchema).optional(),
    removeNodeIds: z.array(z.string()).optional(),
    removeEdgeIds: z.array(z.string()).optional(),
  })
  .openapi({ description: desc('research.graph_patch', '研究图增量补丁') });
export type ResearchGraphPatch = z.infer<typeof ResearchGraphPatchSchema>;

// ---------------------------------------------------------------------------
// Evidence (EV1)
// ---------------------------------------------------------------------------

export const ResearchEvidenceKindSchema = z.enum(['web', 'chunk']);
export type ResearchEvidenceKind = z.infer<typeof ResearchEvidenceKindSchema>;

export const ResearchEvidenceSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .openapi({ description: desc('research.evidence_id', '证据稳定 ID') }),
    kind: ResearchEvidenceKindSchema.openapi({
      description: desc('research.evidence_kind', '证据类型（web / chunk）'),
    }),
    title: z.string().openapi({ description: desc('research.evidence_title', '证据标题') }),
    snippet: z
      .string()
      .optional()
      .openapi({ description: desc('research.evidence_snippet', '证据摘要片段') }),
    url: z
      .string()
      .optional()
      .openapi({ description: desc('research.evidence_url', '网页证据 URL') }),
    sourceId: IdSchema.optional().openapi({
      description: desc('research.evidence_source_id', '笔记本来源 ID'),
    }),
    chunkId: z
      .string()
      .optional()
      .openapi({ description: desc('research.evidence_chunk_id', '来源分块 ID') }),
    collectedAtNodeId: z
      .string()
      .optional()
      .openapi({ description: desc('research.evidence_node_id', '收集该证据的节点 ID') }),
  })
  .openapi({ description: desc('research.evidence', '研究证据') });
export type ResearchEvidence = z.infer<typeof ResearchEvidenceSchema>;

// ---------------------------------------------------------------------------
// Citations for research reports (web-friendly; CitationSchema requires source/chunk ints)
// ---------------------------------------------------------------------------

export const ResearchCitationSchema = z
  .object({
    sourceId: IdSchema.optional().openapi({
      description: desc('research.citation_source_id', '来源 ID（笔记本 chunk 引用）'),
    }),
    sourceName: z
      .string()
      .openapi({ description: desc('research.citation_source_name', '来源名称') }),
    chunkId: z
      .union([IdSchema, z.string()])
      .optional()
      .openapi({ description: desc('research.citation_chunk_id', '分块 ID') }),
    chunkIndex: z
      .number()
      .int()
      .optional()
      .openapi({ description: desc('research.citation_chunk_index', '分块序号') }),
    pageNumber: z.number().int().nullable().optional(),
    paragraphIndex: z.number().int().nullable().optional(),
    snippet: z.string().openapi({ description: desc('research.citation_snippet', '引用片段') }),
    score: z.number().nullable().optional(),
    url: z
      .string()
      .optional()
      .openapi({ description: desc('research.citation_url', '网页引用 URL') }),
  })
  .openapi({ description: desc('research.citation', '研究报告引用条目') });
export type ResearchCitation = z.infer<typeof ResearchCitationSchema>;

// ---------------------------------------------------------------------------
// Report (R6 + K1)
// ---------------------------------------------------------------------------

export const ResearchReportParagraphBlockSchema = z.object({
  type: z.literal('paragraph'),
  text: z.string(),
  citeIds: z.array(z.string()),
});

export const ResearchReportBulletsBlockSchema = z.object({
  type: z.literal('bullets'),
  items: z.array(
    z.object({
      text: z.string(),
      citeIds: z.array(z.string()),
    }),
  ),
});

export const ResearchReportBlockSchema = z.discriminatedUnion('type', [
  ResearchReportParagraphBlockSchema,
  ResearchReportBulletsBlockSchema,
]);
export type ResearchReportBlock = z.infer<typeof ResearchReportBlockSchema>;

export const ResearchReportSectionSchema = z.object({
  id: z.string().min(1),
  heading: z.string(),
  blocks: z.array(ResearchReportBlockSchema),
});
export type ResearchReportSection = z.infer<typeof ResearchReportSectionSchema>;

export const ResearchReportSchema = z
  .object({
    title: z.string().openapi({ description: desc('research.report_title', '报告标题') }),
    sections: z.array(ResearchReportSectionSchema),
    citations: z
      .record(z.string(), ResearchCitationSchema)
      .openapi({ description: desc('research.report_citations', '全局引用 map') }),
  })
  .openapi({ description: desc('research.report', '权威研究报告') });
export type ResearchReport = z.infer<typeof ResearchReportSchema>;

// ---------------------------------------------------------------------------
// Artifact / confirm / create
// ---------------------------------------------------------------------------

export const ResearchArtifactRefSchema = z
  .discriminatedUnion('kind', [
    z.object({ kind: z.literal('report') }),
    z.object({ kind: z.literal('node'), nodeId: z.string().min(1) }),
    z.object({ kind: z.literal('evidence'), evidenceId: z.string().min(1) }),
  ])
  .openapi({ description: desc('research.artifact_ref', '转化产物引用') });
export type ResearchArtifactRef = z.infer<typeof ResearchArtifactRefSchema>;

export const ResearchConfirmBodySchema = z
  .object({
    action: z
      .enum(['continue', 'finish_report', 'approve_branch', 'skip_branch'])
      .openapi({ description: desc('research.confirm_action', '确认动作') }),
    branchNodeId: z
      .string()
      .min(1)
      .optional()
      .openapi({ description: desc('research.branch_node_id', '扩支路节点 ID') }),
  })
  .openapi({ description: desc('research.confirm_body', '待确认响应体') });
export type ResearchConfirmBody = z.infer<typeof ResearchConfirmBodySchema>;

export const ResearchConvertBodySchema = z
  .object({
    artifact: ResearchArtifactRefSchema,
  })
  .openapi({ description: desc('research.convert_body', '转化请求体') });
export type ResearchConvertBody = z.infer<typeof ResearchConvertBodySchema>;

export const ResearchForkBodySchema = z
  .object({
    hint: z
      .string()
      .optional()
      .openapi({ description: desc('research.fork_hint', 'fork 提示') }),
  })
  .openapi({ description: desc('research.fork_body', 'fork 请求体') });
export type ResearchForkBody = z.infer<typeof ResearchForkBodySchema>;

/** PATCH …/nodes/:nodeId — live runs only; at least one field. */
export const ResearchNodePatchBodySchema = z
  .object({
    title: z
      .string()
      .min(1)
      .optional()
      .openapi({ description: desc('research.patch_title', '更新节点标题') }),
    query: z
      .string()
      .optional()
      .openapi({ description: desc('research.patch_query', '更新节点查询') }),
    conclusionStatus: ResearchConclusionStatusSchema.optional().openapi({
      description: desc('research.patch_conclusion_status', '更新节点结论状态'),
    }),
  })
  .refine(
    (body) =>
      body.title !== undefined || body.query !== undefined || body.conclusionStatus !== undefined,
    { message: 'At least one of title, query, conclusionStatus is required' },
  )
  .openapi({ description: desc('research.node_patch_body', '研究节点字段补丁') });
export type ResearchNodePatchBody = z.infer<typeof ResearchNodePatchBodySchema>;

const ResearchCreateFieldsSchema = z.object({
  topic: z
    .string()
    .min(1)
    .openapi({ description: desc('research.topic', '研究主题'), example: '量子纠错进展' }),
  useNotebookSources: z
    .boolean()
    .optional()
    .openapi({ description: desc('research.use_notebook_sources', '是否使用笔记本来源') }),
  sourceIds: z
    .array(IdSchema)
    .optional()
    .openapi({ description: desc('research.source_ids', '深研台内选中的来源 ID') }),
  allowWeb: z
    .boolean()
    .optional()
    .openapi({ description: desc('research.allow_web', '是否允许外网检索') }),
  depth: ResearchDepthSchema.optional(),
});

/** Nested POST /v2/notebooks/:nid/research */
export const ResearchCreateNestedRequestSchema = ResearchCreateFieldsSchema.extend({
  notebookId: IdSchema.optional(),
}).openapi({
  description: desc('research.create_nested', '创建深研 Run（nested）'),
});
export type ResearchCreateNestedRequest = z.infer<typeof ResearchCreateNestedRequestSchema>;

/** Validated create input after H1′ defaults. */
export const ResearchCreateBodySchema = ResearchCreateFieldsSchema.openapi({
  description: desc('research.create_body', '创建深研 Run 请求体'),
});
export type ResearchCreateBody = z.infer<typeof ResearchCreateBodySchema>;

// ---------------------------------------------------------------------------
// Run entity
// ---------------------------------------------------------------------------

export const ResearchRunSchema = z
  .object({
    id: IdSchema.openapi({ description: desc('research.id', '研究任务唯一标识') }),
    notebookId: IdSchema,
    topic: z.string().openapi({ description: desc('research.topic', '研究主题') }),
    status: ResearchRunStatusSchema,
    useNotebookSources: z.boolean(),
    allowWeb: z.boolean(),
    sourceIds: z.array(IdSchema).nullable().optional(),
    depth: ResearchDepthSchema,
    maxSearches: z.number().int().positive(),
    maxNodes: z.number().int().positive(),
    searchesUsed: z.number().int().nonnegative().default(0),
    nodes: z.array(ResearchNodeSchema).default([]),
    edges: z.array(ResearchEdgeSchema).default([]),
    report: ResearchReportSchema.nullable().optional(),
    confirmKind: z.enum(['budget', 'expand_branch']).nullable().optional(),
    confirmBranchNodeId: z.string().nullable().optional(),
    errorMessage: z.string().nullable().optional(),
    /** XOR mutex with work_unit / node_chat; null when idle. */
    llmActivity: ResearchLlmActivitySchema.nullable().optional(),
    /** Node currently holding the LLM mutex (chat or work_unit). */
    activeNodeId: z
      .string()
      .nullable()
      .optional()
      .openapi({ description: desc('research.active_node_id', '当前占用 LLM 的节点') }),
    createdAt: IsoTimestampSchema,
    updatedAt: IsoTimestampSchema,
  })
  .openapi({
    description: desc('research.run', '深研 ResearchRun'),
    example: {
      id: 1,
      notebookId: 1,
      topic: '量子纠错',
      status: 'queued',
      useNotebookSources: false,
      allowWeb: true,
      depth: 'medium',
      maxSearches: 20,
      maxNodes: 30,
      searchesUsed: 0,
      nodes: [],
      edges: [],
      llmActivity: null,
      activeNodeId: null,
      createdAt: '2026-07-21T12:00:00.000Z',
      updatedAt: '2026-07-21T12:00:00.000Z',
    },
  });
export type ResearchRun = z.infer<typeof ResearchRunSchema>;

export const ResearchRunsPageSchema = z.object({
  items: z.array(ResearchRunSchema),
  total: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
});
export type ResearchRunsPage = z.infer<typeof ResearchRunsPageSchema>;

export const ResearchListQuerySchema = PaginationParamsSchema;
export type ResearchListQuery = z.infer<typeof ResearchListQuerySchema>;

// ---------------------------------------------------------------------------
// Stream events (R3b)
// ---------------------------------------------------------------------------

export const ResearchStreamStatusEventSchema = z.object({
  status: ResearchRunStatusSchema,
  reason: z.string().optional(),
});

export const ResearchStreamConfirmEventSchema = z.object({
  kind: z.enum(['budget', 'expand_branch']),
  branchNodeId: z.string().optional(),
  options: z.array(z.string()).optional(),
});

export const ResearchStreamReportReadyEventSchema = z.object({
  runId: IdSchema,
});

export const ResearchStreamLogEventSchema = z.object({
  message: z.string(),
  at: IsoTimestampSchema.optional(),
});

export const ResearchStreamErrorEventSchema = z.object({
  errorCode: z.string(),
  message: z.string(),
});

export const ResearchStreamProgressEventSchema = z.object({
  seq: z.number().int().nonnegative(),
  kind: z.string(),
  at: IsoTimestampSchema,
  nodeId: z.string().optional(),
  headline: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export const ResearchStreamEventSchema = z.discriminatedUnion('event', [
  z.object({ event: z.literal('status'), data: ResearchStreamStatusEventSchema }),
  z.object({ event: z.literal('graph_patch'), data: ResearchGraphPatchSchema }),
  z.object({ event: z.literal('confirm'), data: ResearchStreamConfirmEventSchema }),
  z.object({ event: z.literal('report_ready'), data: ResearchStreamReportReadyEventSchema }),
  z.object({ event: z.literal('log'), data: ResearchStreamLogEventSchema }),
  z.object({ event: z.literal('error'), data: ResearchStreamErrorEventSchema }),
  z.object({ event: z.literal('progress'), data: ResearchStreamProgressEventSchema }),
]);
export type ResearchStreamEvent = z.infer<typeof ResearchStreamEventSchema>;

export const ResearchConvertToNoteResponseSchema = z
  .object({
    outputId: IdSchema,
    type: z.literal('PARAGRAPH'),
  })
  .openapi({ description: desc('research.convert_note_response', '转化为笔记响应') });
export type ResearchConvertToNoteResponse = z.infer<typeof ResearchConvertToNoteResponseSchema>;

export const ResearchConvertToSourceResponseSchema = z
  .object({
    sourceId: IdSchema,
    filename: z.string(),
    chunkCount: z.number().int().nonnegative(),
  })
  .openapi({ description: desc('research.convert_source_response', '转化为来源响应') });
export type ResearchConvertToSourceResponse = z.infer<typeof ResearchConvertToSourceResponseSchema>;

// ---------------------------------------------------------------------------
// C1 — Node chat (SSE short-lived; proposals only — no auto graph mutate)
// ---------------------------------------------------------------------------

export const ResearchNodeActionKindSchema = z
  .enum([
    'prune_node',
    'fork_sibling',
    'rewrite_query',
    'set_status',
    'confirm_finish',
    'confirm_continue',
    'open_report',
  ])
  .openapi({
    description: desc('research.action_kind', '节点对话 ActionProposal 种类（对齐 Lab）'),
  });
export type ResearchNodeActionKind = z.infer<typeof ResearchNodeActionKindSchema>;

export const ResearchNodeActionStatusSchema = z.enum(['pending', 'accepted', 'dismissed']);
export type ResearchNodeActionStatus = z.infer<typeof ResearchNodeActionStatusSchema>;

export const ResearchNodeActionProposalSchema = z
  .object({
    id: z.string().min(1),
    kind: ResearchNodeActionKindSchema,
    label: z.string(),
    rationale: z.string(),
    status: ResearchNodeActionStatusSchema.default('pending'),
    params: z
      .object({
        query: z.string().optional(),
        title: z.string().optional(),
        summary: z.string().optional(),
        conclusionStatus: ResearchConclusionStatusSchema.optional(),
      })
      .optional(),
  })
  .openapi({
    description: desc('research.action_proposal', '节点对话动作提案（需用户 accept→命令口）'),
  });
export type ResearchNodeActionProposal = z.infer<typeof ResearchNodeActionProposalSchema>;

export const ResearchNodeChatBodySchema = z
  .object({
    message: z
      .string()
      .min(1)
      .openapi({ description: desc('research.chat_message', '节点对话用户消息') }),
  })
  .openapi({ description: desc('research.node_chat_body', '节点对话请求体') });
export type ResearchNodeChatBody = z.infer<typeof ResearchNodeChatBodySchema>;

export const ResearchNodeChatChunkEventSchema = z.object({
  text: z.string(),
});

export const ResearchNodeChatProposalEventSchema = ResearchNodeActionProposalSchema;

export const ResearchNodeChatDoneEventSchema = z.object({
  proposals: z.array(ResearchNodeActionProposalSchema).optional(),
});

export const ResearchNodeChatErrorEventSchema = z.object({
  errorCode: z.string(),
  message: z.string(),
});

export const ResearchNodeChatLogEventSchema = z.object({
  message: z.string(),
  nodeId: z.string().optional(),
});

export const ResearchNodeChatStreamEventSchema = z.discriminatedUnion('event', [
  z.object({ event: z.literal('log'), data: ResearchNodeChatLogEventSchema }),
  z.object({ event: z.literal('chunk'), data: ResearchNodeChatChunkEventSchema }),
  z.object({ event: z.literal('proposal'), data: ResearchNodeChatProposalEventSchema }),
  z.object({ event: z.literal('done'), data: ResearchNodeChatDoneEventSchema }),
  z.object({ event: z.literal('error'), data: ResearchNodeChatErrorEventSchema }),
]);
export type ResearchNodeChatStreamEvent = z.infer<typeof ResearchNodeChatStreamEventSchema>;

// ---------------------------------------------------------------------------
// Revisions / report CoW / progress ledger
// ---------------------------------------------------------------------------

export const ResearchRevisionKindSchema = z
  .enum(['auto_complete', 'user_save', 'restore_point'])
  .openapi({ description: desc('research.revision_kind', '修订快照种类') });
export type ResearchRevisionKind = z.infer<typeof ResearchRevisionKindSchema>;

export const ResearchRevisionCreateBodySchema = z
  .object({
    label: z
      .string()
      .optional()
      .openapi({ description: desc('research.revision_label', '修订标签') }),
    from: z
      .enum(['canonical', 'working'])
      .optional()
      .openapi({ description: desc('research.revision_from', '快照报告来源') }),
  })
  .openapi({ description: desc('research.revision_create_body', '创建修订快照') });
export type ResearchRevisionCreateBody = z.infer<typeof ResearchRevisionCreateBodySchema>;

export const ResearchRevisionSchema = z
  .object({
    id: z.string().min(1),
    runId: IdSchema,
    notebookId: IdSchema,
    label: z.string(),
    kind: ResearchRevisionKindSchema,
    parentRevisionId: z.string().nullable().optional(),
    graph: z.object({
      nodes: z.array(ResearchNodeSchema),
      edges: z.array(ResearchEdgeSchema),
    }),
    report: ResearchReportSchema.nullable().optional(),
    searchesUsed: z.number().int().nonnegative(),
    statusAtSave: ResearchRunStatusSchema,
    createdAt: IsoTimestampSchema,
  })
  .openapi({ description: desc('research.revision', '研究修订快照') });
export type ResearchRevision = z.infer<typeof ResearchRevisionSchema>;

export const ResearchRevisionsListSchema = z.object({
  items: z.array(ResearchRevisionSchema),
});
export type ResearchRevisionsList = z.infer<typeof ResearchRevisionsListSchema>;

export const ResearchReportViewSchema = z
  .object({
    canonical: ResearchReportSchema.nullable(),
    working: ResearchReportSchema.nullable().optional(),
    viewing: z.enum(['canonical', 'working']).optional(),
    reportUpdatedAt: IsoTimestampSchema.nullable().optional(),
    workingUpdatedAt: IsoTimestampSchema.nullable().optional(),
  })
  .openapi({ description: desc('research.report_view', '权威 + working 报告视图') });
export type ResearchReportView = z.infer<typeof ResearchReportViewSchema>;

export const ResearchReportPutBodySchema = z
  .object({
    report: ResearchReportSchema,
  })
  .openapi({ description: desc('research.report_put_body', '写入权威报告') });
export type ResearchReportPutBody = z.infer<typeof ResearchReportPutBodySchema>;

export const ResearchProgressKindSchema = z.enum([
  'run_queued',
  'run_running',
  'run_awaiting_confirm',
  'run_completed',
  'run_failed',
  'run_cancelled',
  'unit_started',
  'unit_finished',
  'unit_skipped_pruned',
  'unit_aborted',
  'node_phase',
  'graph_seeded',
  'graph_patched_summary',
  'confirm_entered',
  'confirm_resolved',
  'budget_tick',
  'evidence_added',
  'revision_created',
  'revision_restored',
  'report_canonical_updated',
  'report_working_updated',
  'report_working_discarded',
  'chat_started',
  'chat_finished',
  'chat_aborted',
]);
export type ResearchProgressKind = z.infer<typeof ResearchProgressKindSchema>;

export const ResearchProgressEventSchema = z
  .object({
    id: z.string().min(1),
    runId: IdSchema,
    seq: z.number().int().nonnegative(),
    at: IsoTimestampSchema,
    kind: ResearchProgressKindSchema,
    nodeId: z.string().nullable().optional(),
    headline: z.string().nullable().optional(),
    payload: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .openapi({ description: desc('research.progress_event', '进度账本事件') });
export type ResearchProgressEvent = z.infer<typeof ResearchProgressEventSchema>;

export const ResearchProgressListSchema = z.object({
  items: z.array(ResearchProgressEventSchema),
  nextAfterSeq: z.number().int().nonnegative().optional(),
});
export type ResearchProgressList = z.infer<typeof ResearchProgressListSchema>;

export const ResearchProgressQuerySchema = z.object({
  afterSeq: z.coerce.number().int().nonnegative().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});
export type ResearchProgressQuery = z.infer<typeof ResearchProgressQuerySchema>;
