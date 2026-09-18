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

export const createGeminiProvider = () => {
  const { apiKey, model } = env.ai.gemini;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  const ai = new GoogleGenAI({ apiKey });

  const toContents = (messages) =>
    messages.map(({ role, content }) => ({ role: toGeminiRole(role), parts: [{ text: content }] }));

  return {
    name: 'gemini',
    model,

    async *stream({ system, messages, signal, maxTokens = 4096 }) {
      const stream = await ai.models.generateContentStream({
        model,
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

      let usage;
      for await (const chunk of stream) {
        const text = chunk.text;
        if (text) yield text;
        if (chunk.usageMetadata) usage = chunk.usageMetadata;
      }
      return {
        model,
        inputTokens: usage?.promptTokenCount,
        outputTokens: usage?.candidatesTokenCount,
        stopReason: 'end_turn',
      };
    },

    /**
     * Utility completions (titles etc.) disable Gemini's hidden "thinking" –
     * otherwise reasoning tokens consume the small output budget and the
     * visible answer comes back empty.
     */
    async complete({ system, prompt, model: overrideModel, maxTokens = 64 }) {
      const res = await ai.models.generateContent({
        model: overrideModel ?? model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          systemInstruction: system,
          maxOutputTokens: Math.max(maxTokens, 128),
          thinkingConfig: { thinkingBudget: 0 },
        },
      });
      return (res.text ?? '').trim();
    },
  };
};
