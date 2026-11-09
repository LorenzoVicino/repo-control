// Full-text ranking, in plain TypeScript. SQLite's FTS5 would do this too, but whether it is
// compiled into node:sqlite depends on the Node release (22.13 ships without it), so ranking
// happens here on an in-memory inverted index. A workspace has a few thousand chunks at most,
// which this handles in well under a millisecond per query.

export type TextDocument = { id: number; text: string };
export type TextMatch = { id: number; score: number; snippet: string };

const K1 = 1.2;
const B = 0.75;
const TOKEN = /[\p{L}\p{N}_]+/gu;

/** Lower-cased, accents removed: "Fatturazione" and "fatturazióne" are the same word. */
export function normalize(word: string): string {
  return word.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export function tokenize(text: string): string[] {
  return (text.match(TOKEN) ?? []).map(normalize);
}

/** Query words: two characters or more, at most twelve, without repeats. */
export function queryTerms(query: string): string[] {
  return [...new Set(tokenize(query).filter((word) => word.length > 1))].slice(0, 12);
}

export function buildTextIndex(documents: readonly TextDocument[]) {
  const postings = new Map<string, Map<number, number>>();
  const lengths = new Map<number, number>();
  let totalLength = 0;

  for (const document of documents) {
    const tokens = tokenize(document.text);
    lengths.set(document.id, tokens.length);
    totalLength += tokens.length;
    for (const token of tokens) {
      let posting = postings.get(token);
      if (!posting) postings.set(token, (posting = new Map()));
      posting.set(document.id, (posting.get(document.id) ?? 0) + 1);
    }
  }

  const count = documents.length;
  const averageLength = count ? totalLength / count : 0;
  const texts = new Map(documents.map((document) => [document.id, document.text]));
  const vocabulary = [...postings.keys()];

  /** Every vocabulary word a query word stands for: itself, or any word it is a prefix of. */
  function expand(term: string): string[] {
    return vocabulary.filter((word) => word.startsWith(term));
  }

  function snippet(text: string, terms: readonly string[], radius = 12): string {
    const words = [...text.matchAll(TOKEN)];
    const isMatch = (word: string) => terms.some((term) => normalize(word).startsWith(term));
    const first = words.findIndex((word) => isMatch(word[0]));
    if (first === -1) return text.slice(0, 160);
    const startWord = Math.max(0, first - radius);
    const endWord = Math.min(words.length - 1, first + radius * 2);
    const start = words[startWord].index ?? 0;
    const end = (words[endWord].index ?? 0) + words[endWord][0].length;
    let result = "";
    let cursor = start;
    for (const word of words.slice(startWord, endWord + 1)) {
      const index = word.index ?? 0;
      result += text.slice(cursor, index) + (isMatch(word[0]) ? `«${word[0]}»` : word[0]);
      cursor = index + word[0].length;
    }
    return `${startWord > 0 ? "…" : ""}${result.replace(/\s+/g, " ").trim()}${end < text.length ? "…" : ""}`;
  }

  return {
    size: count,
    /** Ranks documents by BM25. Each query word counts once per document, via its best expansion. */
    search(query: string, limit: number): TextMatch[] {
      const terms = queryTerms(query);
      if (!terms.length || !count) return [];
      const scores = new Map<number, number>();

      for (const term of terms) {
        const best = new Map<number, number>();
        for (const word of expand(term)) {
          const posting = postings.get(word)!;
          const idf = Math.log(1 + (count - posting.size + 0.5) / (posting.size + 0.5));
          for (const [id, frequency] of posting) {
            const length = lengths.get(id) ?? 0;
            const score = idf * ((frequency * (K1 + 1)) / (frequency + K1 * (1 - B + (B * length) / (averageLength || 1))));
            if (score > (best.get(id) ?? 0)) best.set(id, score);
          }
        }
        for (const [id, score] of best) scores.set(id, (scores.get(id) ?? 0) + score);
      }

      return [...scores.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([id, score]) => ({ id, score, snippet: snippet(texts.get(id) ?? "", terms) }));
    }
  };
}

export type TextIndex = ReturnType<typeof buildTextIndex>;
