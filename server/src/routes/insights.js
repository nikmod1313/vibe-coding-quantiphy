import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { getDailyInsights } from '../services/insights.js';
import { humanizeProviderError } from '../services/chat.js';
import { HttpError } from '../middleware/errorHandler.js';

export const insightsRouter = Router();

// GET /api/insights/daily?refresh=1 – flashcards from this session's recent chats
insightsRouter.get(
  '/insights/daily',
  validate(z.object({ refresh: z.enum(['1', 'true']).optional() }), 'query'),
  async (req, res, next) => {
    try {
      res.json(await getDailyInsights(req.sessionId, { force: Boolean(req.query.refresh) }));
    } catch (err) {
      if (err instanceof HttpError) return next(err);
      next(new HttpError(err.noRetry ? 429 : 502, humanizeProviderError(err)));
    }
  },
);
