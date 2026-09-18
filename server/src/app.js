import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { conversationsRouter } from './routes/conversations.js';
import { chatRouter } from './routes/chat.js';
import { providerStatus } from './services/ai/index.js';

export const createApp = () => {
  const app = express();

  app.use(cors({ origin: env.clientOrigin }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      ai: providerStatus(),
      db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      uptime: Math.round(process.uptime()),
    });
  });

  app.use('/api', conversationsRouter);
  app.use('/api', chatRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
};
