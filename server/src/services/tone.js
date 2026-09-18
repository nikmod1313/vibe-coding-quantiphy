/**
 * The "Vibe Check": tone presets.
 *
 * Each tone maps to a system-instruction modifier that the server appends to the
 * base system prompt before every model call. The client only ever sends the
 * tone *id*; all prompt engineering lives here, server-side.
 */
export const TONES = {
  professional: {
    id: 'professional',
    label: 'Professional',
    description: 'Polished, precise, business-ready',
    instruction:
      'Respond in a professional, polished tone. Use clear structure, complete sentences and precise ' +
      'vocabulary. Avoid slang, emojis and filler. Be thorough but well-organised, using headings or ' +
      'numbered lists where they aid clarity.',
  },
  casual: {
    id: 'casual',
    label: 'Casual',
    description: 'Friendly, relaxed, conversational',
    instruction:
      'Respond in a casual, friendly and conversational tone, like a knowledgeable friend chatting. ' +
      'Contractions, light humour and the occasional emoji are welcome. Keep it warm and approachable, ' +
      'and skip corporate phrasing.',
  },
  concise: {
    id: 'concise',
    label: 'Concise',
    description: 'Short, direct, no fluff',
    instruction:
      'Respond as concisely as possible. Lead with the answer. No preamble, no restating the question, ' +
      'no closing remarks. Prefer short sentences and bullet points. Never exceed a few sentences unless ' +
      'the user explicitly asks for detail.',
  },
};

export const TONE_IDS = Object.keys(TONES);
export const DEFAULT_TONE = 'professional';

export const isTone = (value) => TONE_IDS.includes(value);

/** Public, non-sensitive view of tones for the client to render the toggle. */
export const listTones = () =>
  Object.values(TONES).map(({ id, label, description }) => ({ id, label, description }));
