// Chunker — paragraph-based text chunking with configurable size + overlap.
//
// Splits text on paragraph boundaries (double newline). Long paragraphs are
// further split on sentence boundaries with n-char overlap to preserve context
// across chunk boundaries. The chunk_size default is read from the
// `embedding.chunk_size` config section (v1 default 512); overlap is 20% of
// chunk size. Callers can override per-call.
import { getEmbeddingSettings } from '../shared/config.ts';

export interface ChunkResult {
  text: string;
  index: number;
}

export interface ChunkerConfig {
  maxLen: number;
  overlap: number;
}

/** Build chunker config from `embedding.chunk_size` config (c40). */
function resolveChunkerConfig(): ChunkerConfig {
  const { chunk_size } = getEmbeddingSettings();
  return { maxLen: chunk_size, overlap: Math.floor(chunk_size * 0.2) };
}

export const DEFAULT_CHUNKER_CONFIG: ChunkerConfig = {
  maxLen: 512,
  overlap: 102,
};

/**
 * Split text into chunks with configurable size and overlap.
 */
export function chunkText(text: string, config?: ChunkerConfig): ChunkResult[] {
  const { maxLen, overlap } = config ?? resolveChunkerConfig();
  const paragraphs = text
    .split(/\n\n+/u)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: Omit<ChunkResult, 'index'>[] = [];

  for (const para of paragraphs) {
    if (para.length <= maxLen) {
      chunks.push({ text: para });
    } else {
      // Split long paragraphs by sentences with overlap
      const sentences = para.match(/[^.!?]+[.!?]+/gu) ?? [para];
      let current = '';
      for (const s of sentences) {
        if ((current + s).length > maxLen && current.length > 0) {
          chunks.push({ text: current.trim() });
          current = current.slice(-overlap) + s;
        } else {
          current += s;
        }
      }
      if (current.trim()) chunks.push({ text: current.trim() });
    }
  }

  return chunks.map((chunk, i) => ({ ...chunk, index: i }));
}
