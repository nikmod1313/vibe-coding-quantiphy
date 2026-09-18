import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Conversation } from '../models/Conversation.js';
import { HttpError } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { TONE_IDS, DEFAULT_TONE, listTones } from '../services/tone.js';

export const conversationsRouter = Router();

const toneSchema = z.enum(TONE_IDS);
const idParam = z.object({
  id: z.string().refine(mongoose.isValidObjectId, 'Invalid conversation id'),
});

const loadConversation = async (id) => {
  const convo = await Conversation.findById(id);
  if (!convo) throw new HttpError(404, 'Conversation not found');
  return convo;
};

// GET /api/tones – available tone presets for the toggle UI
conversationsRouter.get('/tones', (req, res) => {
  res.json({ tones: listTones(), default: DEFAULT_TONE });
});

// GET /api/conversations – sidebar list
conversationsRouter.get('/conversations', async (req, res, next) => {
  try {
    res.json({ conversations: await Conversation.listSummaries() });
  } catch (err) {
    next(err);
  }
});

// POST /api/conversations – create a thread
conversationsRouter.post(
  '/conversations',
  validate(z.object({ tone: toneSchema.optional() })),
  async (req, res, next) => {
    try {
      const convo = await Conversation.create({ tone: req.body.tone ?? DEFAULT_TONE });
      res.status(201).json({ conversation: convo });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/conversations/:id – full thread with messages
conversationsRouter.get('/conversations/:id', validate(idParam, 'params'), async (req, res, next) => {
  try {
    res.json({ conversation: await loadConversation(req.params.id) });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/conversations/:id – rename or change the active tone
conversationsRouter.patch(
  '/conversations/:id',
  validate(idParam, 'params'),
  validate(
    z
      .object({ title: z.string().trim().min(1).max(120).optional(), tone: toneSchema.optional() })
      .refine((b) => b.title !== undefined || b.tone !== undefined, 'Nothing to update'),
  ),
  async (req, res, next) => {
    try {
      const convo = await loadConversation(req.params.id);
      if (req.body.title !== undefined) {
        convo.title = req.body.title;
        convo.titleGenerated = true; // user-set titles are never overwritten by auto-title
      }
      if (req.body.tone !== undefined) convo.tone = req.body.tone;
      await convo.save();
      res.json({ conversation: convo });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/conversations/:id
conversationsRouter.delete('/conversations/:id', validate(idParam, 'params'), async (req, res, next) => {
  try {
    const result = await Conversation.findByIdAndDelete(req.params.id);
    if (!result) throw new HttpError(404, 'Conversation not found');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
