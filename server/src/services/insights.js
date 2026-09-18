import { Conversation } from '../models/Conversation.js';
import { getProvider } from './ai/index.js';
import { HttpError } from '../middleware/errorHandler.js';
import { TONES } from './tone.js';

/**
 * Daily insights: turns the session's recent conversations into a handful of
 * flashcards (topic → takeaway → a fresh angle worth exploring next).
 *
 * One model request per session per day; the result is cached in memory and
 * invalidated only when a conversation changes, so repeated clicks are free.
 */
const cache = new Map(); // sessionId -> { key, result }
const MAX_THREADS = 8;
const MAX_MESSAGES_PER_THREAD = 6;
const MAX_CHARS_PER_MESSAGE = 500;

const INSIGHTS_SYSTEM =
  'You create concise study flashcards from a user\'s recent chat history. ' +
  'Return ONLY valid JSON matching: {"headline": string, "cards": [{"topic": string, "takeaway": string, "insight": string, "question": string, "conversationIndex": number}]}. ' +
  'Rules: 3 to 6 cards; each field is one or two plain sentences; "takeaway" restates what the user learned; ' +
  '"insight" must add something NEW that was not said in the chat (a related concept, a common pitfall, a practical tip); ' +
  '"question" is a self-test question; "conversationIndex" is the 0-based index of the source conversation. No markdown, no code fences.';

const dayKey = () => new Date().toISOString().slice(0, 10);

/** Builds the digest the model sees. Exported for tests. */
export const buildDigest = (conversations) =>
  conversations
    .map((c, i) => {
      const turns = c.messages
        .slice(-MAX_MESSAGES_PER_THREAD)
        .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, MAX_CHARS_PER_MESSAGE)}`)
        .join('\n');
      return `### Conversation ${i} — "${c.title}" (tone: ${TONES[c.tone]?.label ?? c.tone})\n${turns}`;
    })
    .join('\n\n');

/** Tolerant JSON extraction – models occasionally wrap output in fences. Exported for tests. */
export const parseCards = (raw) => {
  const text = String(raw).replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object in model output');
  const data = JSON.parse(text.slice(start, end + 1));
  if (!Array.isArray(data.cards) || !data.cards.length) throw new Error('No cards in model output');
  return {
    headline: String(data.headline ?? 'Your recent learning'),
    cards: data.cards.slice(0, 6).map((c) => ({
      topic: String(c.topic ?? '').slice(0, 80),
      takeaway: String(c.takeaway ?? '').slice(0, 400),
      insight: String(c.insight ?? '').slice(0, 400),
      question: String(c.question ?? '').slice(0, 200),
      conversationIndex: Number.isInteger(c.conversationIndex) ? c.conversationIndex : null,
    })),
  };
};

export const getDailyInsights = async (sessionId, { force = false } = {}) => {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const conversations = await Conversation.find({ sessionId, updatedAt: { $gte: since }, 'messages.1': { $exists: true } })
    .sort({ updatedAt: -1 })
    .limit(MAX_THREADS)
    .select('title tone updatedAt messages');

  if (!conversations.length) throw new HttpError(404, 'No recent conversations to summarise yet – chat a little first.');

  const key = `${dayKey()}:${conversations.map((c) => `${c._id}@${c.updatedAt.getTime()}`).join(',')}`;
  const cached = cache.get(sessionId);
  if (!force && cached?.key === key) return { ...cached.result, cached: true };

  const raw = await getProvider().complete({ system: INSIGHTS_SYSTEM, prompt: buildDigest(conversations), maxTokens: 1800 });
  const parsed = parseCards(raw);
  const result = {
    generatedAt: new Date().toISOString(),
    headline: parsed.headline,
    cards: parsed.cards.map((c) => ({
      ...c,
      conversationId: c.conversationIndex != null ? String(conversations[c.conversationIndex]?._id ?? '') : '',
      conversationTitle: c.conversationIndex != null ? conversations[c.conversationIndex]?.title ?? '' : '',
    })),
    sources: conversations.length,
  };
  cache.set(sessionId, { key, result });
  return { ...result, cached: false };
};
