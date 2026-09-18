import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDb } from './config/db.js';

const app = createApp();

try {
  await connectDb();
} catch (err) {
  console.error('[db] failed to connect – is MongoDB running?', err.message);
  process.exit(1);
}

app.listen(env.port, () => {
  console.log(`[server] listening on http://localhost:${env.port} (provider: ${env.ai.provider})`);
});
