## Approach

### Output Types (10 total, matching v1)

```ts
// packages/shared/src/schemas/outputs.ts
export const OutputTypes = [
  'FAQ',
  'GUIDE',
  'TIMELINE',
  'MINDMAP',
  'QUIZ',
  'BRIEFING',
  'SLIDES',
  'PARAGRAPH',
  'BULLETS',
  'STRUCTURED',
] as const;

// Each type has a Zod schema
export const FaqSchema = z.object({
  title: z.string(),
  questions: z.array(
    z.object({
      question: z.string(),
      answer: z.string(),
    }),
  ),
});

// Meta information (from v1 OutputTypeMeta)
export const OutputTypeMeta: Record<
  string,
  { description: string; display_text: string; tone: string; prompt: string; is_tool: boolean }
> = {
  FAQ: {
    description: '问答清单',
    display_text: '闪卡',
    tone: 'blue',
    prompt: '整理为 FAQ 问答清单。',
    is_tool: true,
  },
  GUIDE: {
    description: '学习/行动指南',
    display_text: '指南',
    tone: 'green',
    prompt: '生成结构化学习指南。',
    is_tool: true,
  },
  TIMELINE: {
    description: '时间线',
    display_text: '时间线',
    tone: 'orange',
    prompt: '生成时间线。',
    is_tool: true,
  },
  MINDMAP: {
    description: '思维导图',
    display_text: '思维导图',
    tone: 'grape',
    prompt: '生成思维导图。',
    is_tool: true,
  },
  QUIZ: {
    description: '测验',
    display_text: '测验',
    tone: 'violet',
    prompt: '生成测验题目。',
    is_tool: true,
  },
  BRIEFING: {
    description: '简报',
    display_text: '简报',
    tone: 'teal',
    prompt: '生成简报。',
    is_tool: false,
  },
  SLIDES: {
    description: '幻灯片',
    display_text: '幻灯片',
    tone: 'red',
    prompt: '生成幻灯片大纲。',
    is_tool: false,
  },
  PARAGRAPH: {
    description: '段落',
    display_text: '段落',
    tone: 'slate',
    prompt: '生成连贯段落。',
    is_tool: false,
  },
  BULLETS: {
    description: '要点',
    display_text: '要点',
    tone: 'slate',
    prompt: '生成要点列表。',
    is_tool: false,
  },
  STRUCTURED: {
    description: '结构化',
    display_text: '结构化',
    tone: 'slate',
    prompt: '生成结构化输出。',
    is_tool: false,
  },
};
```

### Output Generation Pipeline

```ts
async function generateOutput(type: string, chunkIds: number[]): Promise<Output> {
  // 1. Fetch chunks
  const chunks = await orm.query.chunks.findMany({ where: inArray(chunks.id, chunkIds) });
  const context = chunks.map((c) => `[${c.chunk_index}] ${c.text}`).join('\n\n');

  // 2. Select schema
  const schema = getOutputSchema(type);
  const meta = OutputTypeMeta[type];

  // 3. Generate
  const { object } = await generateObject({
    model: getModel(),
    schema,
    system: meta.prompt,
    prompt: `Context:\n${context}`,
  });

  // 4. Map citations
  const citedChunks = mapCitations(object, chunks);

  // 5. Persist
  const [output] = await orm
    .insert(outputs)
    .values({
      notebook_id,
      type,
      content: object,
      chunk_ids: chunkIds,
    })
    .returning();

  return { ...output, citedChunks };
}
```

### Migration note

pydantic-graph 线性图 (ResolveContext → GenerateOutput → MapCitations → Postprocess → Persist)
→ async 函数链 + generateObject。Zod schema 前后端共享。
