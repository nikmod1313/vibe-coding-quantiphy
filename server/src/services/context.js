/**
 * Context-window management.
 *
 * Models have a finite context; sending the whole thread forever eventually
 * fails (or silently costs a fortune). We keep the most recent turns that fit
 * a token budget, always preserving the latest user prompt, and report what
 * was dropped so the UI can show it.
 *
 * Token estimate: ~4 characters per token is a well-known approximation for
 * English text and is provider-agnostic; swap in a real tokenizer per adapter
 * if exact accounting is ever needed.
 */
export const estimateTokens = (text = '') => Math.ceil(text.length / 4);

export const DEFAULT_CONTEXT_BUDGET = 24_000; // tokens reserved for history

/**
 * @param {{role: string, content: string}[]} messages  oldest → newest
 * @param {object} [opts]
 * @param {number} [opts.budget]      token budget for history
 * @param {number} [opts.maxMessages] hard cap on message count
 * @returns {{ messages: object[], tokens: number, dropped: number }}
 */
export const selectContext = (messages, { budget = DEFAULT_CONTEXT_BUDGET, maxMessages = 60 } = {}) => {
  const kept = [];
  let tokens = 0;

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    const cost = estimateTokens(m.content) + 4; // + per-message overhead
    const isLatestUser = kept.length === 0;
    if (!isLatestUser && (tokens + cost > budget || kept.length >= maxMessages)) break;
    kept.push(m);
    tokens += cost;
  }
  kept.reverse();

  // Providers expect the history to start with a user turn.
  while (kept.length && kept[0].role !== 'user') {
    tokens -= estimateTokens(kept[0].content) + 4;
    kept.shift();
  }

  return { messages: kept, tokens, dropped: messages.length - kept.length };
};
