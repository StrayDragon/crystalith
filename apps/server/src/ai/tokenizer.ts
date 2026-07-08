// Token counting — gpt-tokenizer replaces tiktoken (pure JS, zero wasm).
//
// Supports cl100k_base (GPT-4/GPT-3.5) and o200k_base (GPT-4o). For non-OpenAI
// models the count is approximate (tokenizers are model-specific) but good
// enough for context-window budgeting.
import { encode } from 'gpt-tokenizer';

/** Count tokens in a string using the default (cl100k_base) encoding. */
export function countTokens(text: string): number {
  if (!text) return 0;
  try {
    return encode(text).length;
  } catch {
    // Fallback: rough estimate (~4 chars per token).
    return Math.ceil(text.length / 4);
  }
}

/** Count tokens across a list of chat messages. */
export function countMessageTokens(messages: Array<{ role: string; content: string }>): number {
  let total = 0;
  for (const msg of messages) {
    // ~4 tokens of overhead per message (role + delimiter framing).
    total += 4 + countTokens(msg.role) + countTokens(msg.content);
  }
  return total;
}

/** Truncate text to fit within a token budget (keeps the head). */
export function truncateToTokens(text: string, maxTokens: number): string {
  if (countTokens(text) <= maxTokens) return text;
  try {
    const tokens = encode(text);
    if (tokens.length <= maxTokens) return text;
    // Decode the truncated token list back to text.
    const { decode } = require('gpt-tokenizer');
    return decode(tokens.slice(0, maxTokens));
  } catch {
    // Fallback: char-based truncation.
    return text.slice(0, maxTokens * 4);
  }
}
