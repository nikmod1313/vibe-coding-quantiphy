import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { conversationsRouter } from './routes/conversations.js';
import { chatRouter } from './routes/chat.js';
import { providerStatus } from './services/ai/index.js';
import { session } from './middleware/session.js';

export const createApp = () => {
  const app = express();

  // --- Security baseline -------------------------------------------------
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false })); // API only; CSP belongs to the client host
  app.use(cors({ origin: env.clientOrigin, credentials: true, methods: ['GET', 'POST', 'PATCH', 'DELETE'] }));
  app.use(express.json({ limit: '256kb', strict: true }));

  // Generous global limit; tighter one on generation which costs real money.
  app.use('/api', rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));
  app.use(
    '/api/conversations/:id/messages',
    rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false,
      message: { error: 'Too many messages – slow down for a minute.' } }),
  );

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      ai: providerStatus(),
      db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      uptime: Math.round(process.uptime()),
    });
  });

  app.use('/api', session);
  app.use('/api', conversationsRouter);
  app.use('/api', chatRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
};
