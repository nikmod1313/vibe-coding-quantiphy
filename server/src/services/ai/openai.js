import OpenAI from 'openai';
import { env } from '../../config/env.js';

/**
 * OpenAI provider adapter – same contract as the Anthropic adapter so the
 * chat service is provider-agnostic. Selected with AI_PROVIDER=openai.
 */
export const createOpenAIProvider = () => {
  const { apiKey, model } = env.ai.openai;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');
  const client = new OpenAI({ apiKey });

  return {
    name: 'openai',
    model,

    async *stream({ system, messages, signal, maxTokens = 4096 }) {
      const stream = await client.chat.completions.create(
        {
          model,
          max_tokens: maxTokens,
          stream: true,
          stream_options: { include_usage: true },
          messages: [{ role: 'system', content: system }, ...messages],
        },
        { signal },
      );

      let usage;
      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) yield delta;
        if (chunk.usage) usage = chunk.usage;
      }
      return {
        model,
        inputTokens: usage?.prompt_tokens,
        outputTokens: usage?.completion_tokens,
        stopReason: 'end_turn',
      };
    },

    async complete({ system, prompt, model: overrideModel, maxTokens = 64 }) {
      const res = await client.chat.completions.create({
        model: overrideModel ?? model,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
      });
      return res.choices[0]?.message?.content?.trim() ?? '';
    },
  };
};
