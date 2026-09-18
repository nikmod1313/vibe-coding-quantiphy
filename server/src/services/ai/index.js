import { env } from '../../config/env.js';
import { createAnthropicProvider } from './anthropic.js';
import { createOpenAIProvider } from './openai.js';

const factories = {
  anthropic: createAnthropicProvider,
  openai: createOpenAIProvider,
};

let instance;

/**
 * Lazily builds the configured provider (singleton). Throwing here – rather
 * than at import time – lets the server boot and report a clear error via
 * /api/health even when the key is missing.
 */
export const getProvider = () => {
  if (instance) return instance;
  const factory = factories[env.ai.provider];
  if (!factory) {
    throw new Error(`Unknown AI_PROVIDER "${env.ai.provider}". Use one of: ${Object.keys(factories).join(', ')}`);
  }
  instance = factory();
  return instance;
};

export const providerStatus = () => {
  try {
    const p = getProvider();
    return { provider: p.name, model: p.model, ready: true };
  } catch (err) {
    return { provider: env.ai.provider, ready: false, error: err.message };
  }
};
