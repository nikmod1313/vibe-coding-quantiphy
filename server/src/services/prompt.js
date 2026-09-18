import { TONES } from './tone.js';

const BASE_SYSTEM_PROMPT =
  'You are VibeChat, a helpful, knowledgeable AI assistant. ' +
  'Format answers with Markdown when it improves readability (lists, code blocks with language tags, bold for key terms). ' +
  'If you are unsure, say so rather than guessing.';

/**
 * Composes the final system prompt: base persona + tone modifier.
 * This is the single place where the user's tone preference is turned into
 * a system instruction – the client never sees or sends prompt text.
 */
export const buildSystemPrompt = (toneId) => {
  const tone = TONES[toneId];
  if (!tone) throw new Error(`Unknown tone: ${toneId}`);
  return `${BASE_SYSTEM_PROMPT}\n\n## Response style: ${tone.label}\n${tone.instruction}`;
};
