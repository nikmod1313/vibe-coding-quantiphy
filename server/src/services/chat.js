import { Conversation } from '../models/Conversation.js';
import { HttpError } from '../middleware/errorHandler.js';
import { getProvider } from './ai/index.js';
import { buildSystemPrompt } from './prompt.js';
import { selectContext, estimateTokens } from './context.js';
import { isTone } from './tone.js';
import { maybeGenerateTitle } from './title.js';

/**
 * Core chat business logic.
 *
 * sendMessage() persists the user turn, streams the assistant reply through
 * the `emit` callback, then persists the assistant turn with metadata.
 * The HTTP layer (routes/chat.js) only translates `emit` into SSE frames.
 *
 * @param {object} args
 * @param {string} args.conversationId
 * @param {string} args.sessionId       owner scope – threads from other sessions are invisible
 * @param {string} [args.content]       user prompt (omitted when regenerating)
 * @param {boolean} [args.regenerate]   re-answer the last user prompt without persisting a new user turn
 * @param {string} [args.editMessageId] rewrite this earlier user message: the thread is truncated from it and re-run
 * @param {string} [args.tone]          overrides the conversation's active tone for this turn
 * @param {AbortSignal} args.signal     aborts the upstream model request
 * @param {(event: string, data: object) => void} args.emit
 */
const RETRYABLE = new Set([429, 500, 502, 503, 529]);
const MAX_ATTEMPTS = 3;

/** Turns nested provider error payloads into a short, user-facing message. */
export const humanizeProviderError = (err) => {
  const status = err?.status ?? err?.code;
  if (status === 429) return 'Rate limit reached. Please wait a moment and try again.';
  if (status === 503 || status === 529) return 'The model is under heavy load right now. Please try again in a few seconds.';
  if (status === 401 || status === 403) return 'The AI provider rejected the API key. Check server configuration.';
  if (status === 404) return 'The configured model is not available for this API key.';
  let msg = err?.message ?? 'Generation failed';
  // Provider SDKs sometimes stringify the whole JSON error body.
  for (let i = 0; i < 3; i += 1) {
    try {
      const parsed = JSON.parse(msg);
      msg = parsed?.error?.message ?? parsed?.message ?? msg;
    } catch {
      break;
    }
  }
  return msg.slice(0, 300);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const sendMessage = async ({ conversationId, sessionId, content, regenerate = false, editMessageId, tone, signal, emit }) => {
  const convo = await Conversation.findOne({ _id: conversationId, sessionId });
  if (!convo) throw new HttpError(404, 'Conversation not found');

  if (tone && isTone(tone) && tone !== convo.tone) convo.tone = tone;
  const activeTone = convo.tone;

  // 0. Editing an earlier prompt: drop it and everything after it, then
  //    continue exactly like a fresh send. Only user messages are editable.
  if (editMessageId) {
    const idx = convo.messages.findIndex((m) => String(m._id) === editMessageId && m.role === 'user');
    if (idx === -1) throw new HttpError(404, 'Message not found or not editable');
    convo.messages.splice(idx);
    emit('truncated', { fromMessageId: editMessageId });
  }

  // 1. Persist the user turn immediately so it survives a failed generation.
  if (!regenerate) {
    convo.messages.push({ role: 'user', content });
    await convo.save();
    emit('user_message', { message: convo.messages.at(-1) });
  }

  // 2. Build the model request: history up to the last user turn (so the model
  //    never sees two consecutive assistant turns), trimmed to the token budget,
  //    plus the tone-aware system prompt.
  const lastUserIdx = convo.messages.findLastIndex((m) => m.role === 'user');
  if (lastUserIdx === -1) throw new HttpError(400, 'Nothing to regenerate');
  const context = selectContext(
    convo.messages.slice(0, lastUserIdx + 1).map(({ role, content }) => ({ role, content })),
  );
  const history = context.messages;
  const provider = getProvider();
  const system = buildSystemPrompt(activeTone);
  const contextTokens = context.tokens + estimateTokens(system);

  emit('start', {
    tone: activeTone,
    provider: provider.name,
    model: provider.model,
    context: { messages: history.length, tokens: contextTokens, dropped: context.dropped },
  });

  // 3. Stream tokens.
  const startedAt = Date.now();
  let text = '';
  let usage = {};
  let stopped = false;

  // Transient provider errors (429/5xx) are retried with backoff, but only
  // while nothing has been streamed yet – we never replay partial output.
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const gen = provider.stream({ system, messages: history, signal, maxTokens: 8192 });
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
      break;
    } catch (err) {
      if (signal?.aborted || err?.name === 'AbortError') {
        stopped = true;
        break;
      }
      const status = err?.status ?? err?.code;
      if (!text && RETRYABLE.has(status) && attempt < MAX_ATTEMPTS) {
        emit('retry', { attempt, status });
        await sleep(600 * attempt);
        continue;
      }
      throw Object.assign(new Error(humanizeProviderError(err)), { status: typeof status === 'number' ? status : 502 });
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
      contextMessages: history.length,
      contextDropped: context.dropped,
      stopped,
    },
  });
  await convo.save();

  emit('done', { stopped, message: convo.messages.at(-1) });

  // 5. Fire-and-forget: name the thread after its first exchange.
  if (!convo.titleGenerated) {
    await maybeGenerateTitle(convo._id);
    const updated = await Conversation.findById(convo._id).select('title');
    emit('title', { conversationId: String(convo._id), title: updated?.title });
  }
};
