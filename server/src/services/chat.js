import { Conversation } from '../models/Conversation.js';
import { HttpError } from '../middleware/errorHandler.js';
import { getProvider } from './ai/index.js';
import { buildSystemPrompt, MAX_CONTEXT_MESSAGES } from './prompt.js';
import { isTone } from './tone.js';

/**
 * Core chat business logic.
 *
 * sendMessage() persists the user turn, streams the assistant reply through
 * the `emit` callback, then persists the assistant turn with metadata.
 * The HTTP layer (routes/chat.js) only translates `emit` into SSE frames.
 *
 * @param {object} args
 * @param {string} args.conversationId
 * @param {string} args.content         user prompt
 * @param {string} [args.tone]          overrides the conversation's active tone for this turn
 * @param {AbortSignal} args.signal     aborts the upstream model request
 * @param {(event: string, data: object) => void} args.emit
 */
export const sendMessage = async ({ conversationId, content, tone, signal, emit }) => {
  const convo = await Conversation.findById(conversationId);
  if (!convo) throw new HttpError(404, 'Conversation not found');

  if (tone && isTone(tone) && tone !== convo.tone) convo.tone = tone;
  const activeTone = convo.tone;

  // 1. Persist the user turn immediately so it survives a failed generation.
  convo.messages.push({ role: 'user', content });
  await convo.save();
  const userMessage = convo.messages.at(-1);
  emit('user_message', { message: userMessage });

  // 2. Build the model request: bounded history + tone-aware system prompt.
  const history = convo.messages.slice(-MAX_CONTEXT_MESSAGES).map(({ role, content }) => ({ role, content }));
  const provider = getProvider();
  const system = buildSystemPrompt(activeTone);

  emit('start', { tone: activeTone, provider: provider.name, model: provider.model });

  // 3. Stream tokens.
  const startedAt = Date.now();
  let text = '';
  let usage = {};
  let stopped = false;

  try {
    const gen = provider.stream({ system, messages: history, signal });
    // Manual iteration so we can capture the generator's return value (usage).
    for (;;) {
      const { value, done } = await gen.next();
      if (done) {
        usage = value ?? {};
        break;
      }
      text += value;
      emit('token', { text: value });
    }
  } catch (err) {
    if (signal?.aborted || err?.name === 'AbortError') {
      stopped = true;
    } else {
      throw err;
    }
  }

  // 4. Persist the assistant turn (even partial output when the user stopped it).
  if (!text && stopped) {
    emit('done', { stopped: true, message: null });
    return;
  }

  convo.messages.push({
    role: 'assistant',
    content: text,
    tone: activeTone,
    meta: {
      provider: provider.name,
      model: usage.model ?? provider.model,
      latencyMs: Date.now() - startedAt,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      stopped,
    },
  });
  await convo.save();

  emit('done', { stopped, message: convo.messages.at(-1) });
};
