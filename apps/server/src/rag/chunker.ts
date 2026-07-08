// Chunker — paragraph-based text chunking with configurable size + overlap.
//
// Splits text on paragraph boundaries (double newline). Long paragraphs are
// further split on sentence boundaries with n-char overlap to preserve context
// across chunk boundaries.
export interface ChunkResult {
  text: string;
  index: number;
}

export interface ChunkerConfig {
  maxLen: number;
  overlap: number;
}

export const DEFAULT_CHUNKER_CONFIG: ChunkerConfig = {
  maxLen: 500,
  overlap: 50,
};

/**
 * Split text into chunks with configurable size and overlap.
 */
export function chunkText(
  text: string,
  config: ChunkerConfig = DEFAULT_CHUNKER_CONFIG,
): ChunkResult[] {
  const { maxLen, overlap } = config;
  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: Omit<ChunkResult, 'index'>[] = [];

  for (const para of paragraphs) {
    if (para.length <= maxLen) {
      chunks.push({ text: para });
    } else {
      // Split long paragraphs by sentences with overlap
      const sentences = para.match(/[^.!?]+[.!?]+/g) ?? [para];
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
