import { Conversation } from '../models/Conversation.js';
import { getProvider } from './ai/index.js';
import { env } from '../config/env.js';

const TITLE_SYSTEM =
  'You generate short titles for chat conversations. Reply with ONLY the title: ' +
  '3–6 words, Title Case, no quotes, no trailing punctuation, no emojis.';

const STOP = new Set(['a', 'an', 'the', 'please', 'can', 'you', 'could', 'me', 'my', 'i', 'to', 'of', 'in', 'for', 'is', 'are', 'what', 'how', 'why', 'give', 'tell', 'explain', 'write']);

/** Title from the first prompt – no API call, so it never spends quota. */
export const heuristicTitle = (prompt = '') => {
  const words = prompt
    .replace(/[`*_#>\[\]()"']/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const meaningful = words.filter((w) => !STOP.has(w.toLowerCase()));
  const picked = (meaningful.length >= 3 ? meaningful : words).slice(0, 6);
  const title = picked.map((w) => w[0].toUpperCase() + w.slice(1)).join(' ').replace(/[?.!,:;]+$/, '');
  return title.slice(0, 60) || 'New conversation';
};

/**
 * Names the thread after its first exchange. Default strategy is heuristic
 * (free); AUTO_TITLE=ai asks the model for a nicer one and falls back to the
 * heuristic on any failure. Runs after the reply has streamed so it never
 * delays the user.
 */
export const maybeGenerateTitle = async (conversationId) => {
  const convo = await Conversation.findById(conversationId);
  if (!convo || convo.titleGenerated || convo.messages.length < 2) return;

  const [user, assistant] = convo.messages;
  let title = heuristicTitle(user.content);

  if (env.autoTitle === 'ai') {
    try {
      const prompt = `User: ${user.content.slice(0, 600)}\n\nAssistant: ${assistant.content.slice(0, 600)}`;
      const raw = await getProvider().complete({ system: TITLE_SYSTEM, prompt, maxTokens: 24 });
      const cleaned = raw.replace(/^["'\s]+|["'\s.]+$/g, '').split('\n')[0].slice(0, 80);
      if (cleaned) title = cleaned;
    } catch (err) {
      console.warn('[title] AI title failed, using heuristic:', err.message);
    }
  }

  convo.title = title;
  convo.titleGenerated = true;
  await convo.save();
};
