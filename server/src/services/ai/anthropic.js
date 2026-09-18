import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../config/env.js';

/**
 * Anthropic (Claude) provider adapter.
 * Implements the provider contract: `stream({ system, messages, signal })`
 * is an async generator yielding text deltas; when it finishes, its return
 * value carries usage + model metadata.
 */
export const createAnthropicProvider = () => {
  const { apiKey, model } = env.ai.anthropic;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
  const client = new Anthropic({ apiKey });

  return {
    name: 'anthropic',
    model,

    async *stream({ system, messages, signal, maxTokens = 4096 }) {
      const stream = client.messages.stream(
        {
          model,
          max_tokens: maxTokens,
          system,
          messages: messages.map(({ role, content }) => ({ role, content })),
        },
        { signal },
      );

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield event.delta.text;
        }
      }

      const final = await stream.finalMessage();
      return {
        model: final.model,
        inputTokens: final.usage.input_tokens,
        outputTokens: final.usage.output_tokens,
        stopReason: final.stop_reason,
      };
    },

    /** One-shot, non-streaming completion for short utility tasks (e.g. titles). */
    async complete({ system, prompt, model: overrideModel, maxTokens = 64 }) {
      const res = await client.messages.create({
        model: overrideModel ?? model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: prompt }],
      });
      return res.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('')
        .trim();
    },
  };
};
