import 'dotenv/config';

/**
 * Centralised, validated environment config.
 * Everything else imports from here – no raw process.env access elsewhere.
 */
const required = (key, fallback) => {
  const value = process.env[key] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
};

/**
 * Security: API keys are read exactly once, here, and only ever handed to the
 * provider SDK. They are never logged, never serialised into API responses and
 * never shipped to the client bundle (Vite only exposes VITE_* variables).
 */
export const env = {
  port: Number(process.env.PORT ?? 3001),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  mongoUri: required('MONGODB_URI', 'mongodb://127.0.0.1:27017/vibe-chat'),
  ai: {
    provider: (process.env.AI_PROVIDER ?? 'gemini').toLowerCase(),
    gemini: {
      apiKey: process.env.GEMINI_API_KEY ?? '',
      model: process.env.GEMINI_MODEL ?? 'gemini-3.6-flash',
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY ?? '',
      model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5',
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY ?? '',
      model: process.env.OPENAI_MODEL ?? 'gpt-4o',
    },
  },
};

const activeKey = env.ai[env.ai.provider]?.apiKey;
if (!activeKey) {
  throw new Error(
    `AI_PROVIDER is "${env.ai.provider}" but its API key is empty. ` +
      'Add it to server/.env (see server/.env.example). Never commit .env.',
  );
}
