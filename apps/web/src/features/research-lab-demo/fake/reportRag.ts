import type { LabCitation } from '../../research-lab/model/types';

export interface ReportRagChunk {
  id: string;
  source: 'report' | 'citation';
  title: string;
  text: string;
  citationId?: string;
  score: number;
}

export interface ReportRagAnswer {
  text: string;
  citationIds: string[];
  chunks: ReportRagChunk[];
}

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[\s,，。；;、./\\|_+\-—:：?？!！"'“”‘’()[\]{}]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

function scoreText(tokens: string[], text: string): number {
  if (tokens.length === 0) return 0;
  const hay = text.toLowerCase();
  let hits = 0;
  for (const t of tokens) {
    if (hay.includes(t)) hits += 1;
  }
  return hits / tokens.length;
}

function splitReportParagraphs(reportMarkdown: string): Array<{ id: string; text: string }> {
  return reportMarkdown
    .split(/\n{2,}/u)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((text, i) => ({ id: `report-p${i + 1}`, text }));
}

/** Build retrieval corpus from report body + citation snippets. */
export function buildReportCorpus(
  reportMarkdown: string,
  citations: Record<string, LabCitation>,
): Array<Omit<ReportRagChunk, 'score'>> {
  const paras = splitReportParagraphs(reportMarkdown).map((p) => ({
    id: p.id,
    source: 'report' as const,
    title: '报告段落',
    text: p.text,
  }));
  const cites = Object.values(citations).map((c) => ({
    id: `cite-${c.id}`,
    source: 'citation' as const,
    title: c.title,
    text: `${c.title}\n${c.snippet}`,
    citationId: c.id,
  }));
  return [...paras, ...cites];
}

/** Keyword retrieve over report + citations (fake, no network). */
export function retrieveReportChunks(
  query: string,
  reportMarkdown: string,
  citations: Record<string, LabCitation>,
  topK = 3,
): ReportRagChunk[] {
  const tokens = tokenize(query);
  const corpus = buildReportCorpus(reportMarkdown, citations);
  const scored: ReportRagChunk[] = corpus
    .map((c) => ({
      ...c,
      score: scoreText(tokens, `${c.title}\n${c.text}`),
    }))
    .filter((c) => c.score > 0)
    .toSorted((a, b) => b.score - a.score)
    .slice(0, topK);

  if (scored.length > 0) return scored;

  // Fallback: first report paragraph + first citation so demo always answers.
  const fallback = corpus.slice(0, Math.min(2, corpus.length)).map((c, i) => ({
    ...c,
    score: 0.1 - i * 0.01,
  }));
  return fallback;
}

/** Template answer citing retrieved chunks. */
export function answerFromChunks(query: string, chunks: ReportRagChunk[]): ReportRagAnswer {
  const citationIds = [
    ...new Set(chunks.map((c) => c.citationId).filter((id): id is string => Boolean(id))),
  ];
  const snippets = chunks
    .slice(0, 3)
    .map((c, i) => `(${i + 1}) ${c.text.replaceAll(/\s+/gu, ' ').slice(0, 120)}…`)
    .join('\n');
  const citeNote =
    citationIds.length > 0
      ? `\n\n参考引用：${citationIds.map((id) => `[${id}]`).join(' ')}`
      : '\n\n（本次主要依据报告正文段落）';

  return {
    text: `针对「${query.trim()}」，基于本文档检索到的片段：\n${snippets}\n\n综合来看：证据与报告叙述一致的部分可优先采信；标为过时的来源请人工复核后再写入结论。${citeNote}`,
    citationIds,
    chunks,
  };
}
