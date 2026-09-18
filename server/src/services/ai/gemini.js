import { GoogleGenAI } from '@google/genai';
import { env } from '../../config/env.js';

/**
 * Google Gemini provider adapter – same contract as the Anthropic/OpenAI
 * adapters. Selected with AI_PROVIDER=gemini.
 *
 * Gemini uses roles `user` / `model` (not `assistant`) and takes the system
 * prompt as `systemInstruction` in the request config.
 */
const toGeminiRole = (role) => (role === 'assistant' ? 'model' : 'user');

/**
 * Gemini wraps errors as JSON text. Pull out the status and whether the
 * failure is a *daily* quota (retrying that only burns more quota).
 */
const classify = (err) => {
  const raw = String(err?.message ?? '');
  let body = null;
  try { body = JSON.parse(raw); } catch { /* not JSON */ }
  // The SDK nests the API's JSON body inside error.message (sometimes twice),
  // so match on the raw text rather than trusting one particular shape.
  const status = err?.status ?? body?.error?.code ?? (/"code":\s*(\d{3})/.exec(raw)?.[1] && Number(RegExp.$1));
  const perDay = /PerDay|per day|exceeded your current quota/i.test(raw);
  return { status, quotaExhausted: status === 429 && perDay };
};

const decorate = (err, model) => {
  const { status, quotaExhausted } = classify(err);
  if (status) err.status = status;
  if (quotaExhausted) {
    err.noRetry = true;
    err.message = `Daily free-tier quota for ${model} is exhausted.`;
  }
  return err;
};

export const createGeminiProvider = () => {
  const { apiKey, model, fallbackModels } = env.ai.gemini;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  const ai = new GoogleGenAI({ apiKey });
  // Primary first; each free-tier model has its own daily quota, so a chain
  // keeps the app usable when one is used up. Exhausted models are skipped
  // for the rest of the process lifetime.
  const chain = [model, ...fallbackModels].filter((m, i, a) => m && a.indexOf(m) === i);
  const exhausted = new Set();
  const candidates = () => chain.filter((m) => !exhausted.has(m));

  const toContents = (messages) =>
    messages.map(({ role, content }) => ({ role: toGeminiRole(role), parts: [{ text: content }] }));

  return {
    name: 'gemini',
    model,

    async *stream({ system, messages, signal, maxTokens = 4096 }) {
      const models = candidates();
      if (!models.length) throw Object.assign(new Error('All configured Gemini models have exhausted their daily quota.'), { status: 429, noRetry: true });

      for (const [i, useModel] of models.entries()) {
        let stream;
        try {
          stream = await ai.models.generateContentStream({
            model: useModel,
            contents: toContents(messages),
            config: {
              systemInstruction: system,
              maxOutputTokens: maxTokens,
              abortSignal: signal,
              // Chat is latency-sensitive: disable hidden reasoning so the first
              // token arrives fast. The tone modifier does the styling work.
              thinkingConfig: { thinkingBudget: 0 },
            },
          });
        } catch (err) {
          decorate(err, useModel);
          if (err.noRetry && i < models.length - 1) {
            exhausted.add(useModel);
            console.warn(`[gemini] ${useModel} quota exhausted – falling back to ${models[i + 1]}`);
            continue;
          }
          throw err;
        }

        let usage;
        try {
          for await (const chunk of stream) {
            const text = chunk.text;
            if (text) yield text;
            if (chunk.usageMetadata) usage = chunk.usageMetadata;
          }
        } catch (err) {
          throw decorate(err, useModel);
        }
        return {
          model: useModel,
          inputTokens: usage?.promptTokenCount,
          outputTokens: usage?.candidatesTokenCount,
          stopReason: 'end_turn',
        };
      }
      return { model };
    },

    /**
     * Utility completions (titles etc.) disable Gemini's hidden "thinking" –
     * otherwise reasoning tokens consume the small output budget and the
     * visible answer comes back empty.
     */
    async complete({ system, prompt, model: overrideModel, maxTokens = 64 }) {
      const models = overrideModel ? [overrideModel] : candidates();
      if (!models.length) throw Object.assign(new Error('All configured Gemini models have exhausted their daily quota.'), { status: 429, noRetry: true });

      let lastErr;
      for (const [i, useModel] of models.entries()) {
        // Short retry for transient 5xx/429-per-minute; quota exhaustion moves to the next model.
        for (let attempt = 1; attempt <= 3; attempt += 1) {
          try {
            const res = await ai.models.generateContent({
              model: useModel,
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              config: {
                systemInstruction: system,
                maxOutputTokens: Math.max(maxTokens, 128),
                thinkingConfig: { thinkingBudget: 0 },
              },
            });
            return (res.text ?? '').trim();
          } catch (err) {
            lastErr = decorate(err, useModel);
            if (lastErr.noRetry) {
              exhausted.add(useModel);
              if (i < models.length - 1) console.warn(`[gemini] ${useModel} quota exhausted – falling back to ${models[i + 1]}`);
              break;
            }
            if (![429, 500, 502, 503, 529].includes(lastErr.status) || attempt === 3) throw lastErr;
            await new Promise((r) => setTimeout(r, (lastErr.status === 429 ? 2500 : 800) * attempt));
          }
        }
      }
      throw lastErr;
    },

    /** For /api/health – lets a judge see the fallback chain state without spending a request. */
    status: () => ({ chain, exhausted: [...exhausted] }),
  };
};
