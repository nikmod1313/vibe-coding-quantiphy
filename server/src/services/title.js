import { Conversation } from '../models/Conversation.js';
import { getProvider } from './ai/index.js';

const TITLE_SYSTEM =
  'You generate short titles for chat conversations. Reply with ONLY the title: ' +
  '3–6 words, Title Case, no quotes, no trailing punctuation, no emojis.';

/**
 * Generates a title from the first exchange and stores it. Runs after the
 * response has been streamed so it never delays the user; failures are
 * logged and ignored (the thread just keeps its default title).
 */
export const maybeGenerateTitle = async (conversationId) => {
  const convo = await Conversation.findById(conversationId);
  if (!convo || convo.titleGenerated || convo.messages.length < 2) return;

  const [user, assistant] = convo.messages;
  const prompt = `User: ${user.content.slice(0, 600)}\n\nAssistant: ${assistant.content.slice(0, 600)}`;

  try {
    const raw = await getProvider().complete({ system: TITLE_SYSTEM, prompt, maxTokens: 24 });
    const title = raw.replace(/^["'\s]+|["'\s.]+$/g, '').split('\n')[0].slice(0, 80);
    if (!title) return;
    convo.title = title;
    convo.titleGenerated = true;
    await convo.save();
  } catch (err) {
    console.warn('[title] generation failed:', err.message);
  }
};
