// CJK-aware tokenizer for the keyword retrieval channel (c132 r487).
//
// sqlite FTS5 has no script-aware tokenizer we can register (bun:sqlite exposes
// no custom SQL function API), so tokenization happens application-side:
//   - CJK runs (Han/Kana/Hangul) → per-character bigrams ("向量数据库" →
//     向量 量数 数据 据库); a lone CJK char stays a single-char token.
//   - Other word runs (latin, digits, underscore identifiers, other scripts)
//     → one lowercased token ("EmbeddingGemma" → embeddinggemma).
// `tokenizeForIndex` produces the space-joined token string stored in
// `chunks.text_tokens`; `buildMatchQuery` turns a user query into an OR-joined
// quoted FTS5 MATCH expression over the same token space (OR + bm25 ranking,
// search-engine semantics; quoting keeps FTS syntax characters inert).
const CJK_CHAR = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const WORD_CHAR = /[\p{L}\p{N}_]/u;

/** Tokenize text into the keyword-channel token space. */
export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  let cjkRun = '';
  let wordRun = '';

  const flushCjk = () => {
    if (!cjkRun) return;
    if (cjkRun.length === 1) {
      tokens.push(cjkRun);
    } else {
      for (let i = 0; i < cjkRun.length - 1; i++) tokens.push(cjkRun.slice(i, i + 2));
    }
    cjkRun = '';
  };
  const flushWord = () => {
    if (wordRun) {
      tokens.push(wordRun.toLowerCase());
      wordRun = '';
    }
  };

  for (const ch of text) {
    if (CJK_CHAR.test(ch)) {
      flushWord();
      cjkRun += ch;
    } else if (WORD_CHAR.test(ch)) {
      flushCjk();
      wordRun += ch;
    } else {
      flushCjk();
      flushWord();
    }
  }
  flushCjk();
  flushWord();
  return tokens;
}

/** Space-joined token string for `chunks.text_tokens` (index side). */
export function tokenizeForIndex(text: string): string {
  return tokenize(text).join(' ');
}

/**
 * OR-joined quoted MATCH expression for a user query (query side). Returns ''
 * when the query yields no tokens — callers skip the keyword channel then.
 */
export function buildMatchQuery(query: string): string {
  return tokenize(query)
    .map((t) => `"${t}"`)
    .join(' OR ');
}
