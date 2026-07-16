// Extraction interface — shared types for web content extractors.
// Mirrors v1 shared/extraction/extractor.py plugin protocol.
export interface ExtractedContent {
  title: string;
  // markdown or plain text
  content: string;
  description?: string;
  author?: string;
  publishedDate?: string;
  language?: string;
  extractorUsed: string;
}

export interface Extractor {
  name: string;
  isAvailable(config: unknown): boolean;
  extract(url: string, config: unknown): Promise<ExtractedContent>;
}
