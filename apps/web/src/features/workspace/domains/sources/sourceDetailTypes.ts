import type { SourceSummary } from '@crystalith/shared';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface SourceBrief {
  summary: string;
  keyPoints: string[];
  topics: string[];
  wordCount: number;
  generatedAt: Date | null;
}

export type SourceDetailTabValue = 'overview' | 'raw';

export function hasGeneratedBrief(brief: SourceBrief | null): brief is SourceBrief & {
  generatedAt: Date;
} {
  return Boolean(brief?.generatedAt && brief.summary);
}

export function briefFromResponse(response: SourceSummary): SourceBrief {
  return {
    summary: response.summary,
    keyPoints: response.keyPoints,
    topics: response.topics,
    wordCount: response.wordCount,
    generatedAt: response.generatedAt ? new Date(response.generatedAt) : null,
  };
}
