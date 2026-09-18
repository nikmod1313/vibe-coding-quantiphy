import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { sendMessage } from '../services/chat.js';
import { TONE_IDS } from '../services/tone.js';

export const chatRouter = Router();

const bodySchema = z
  .object({
    content: z.string().trim().min(1, 'Message cannot be empty').max(8000).optional(),
    regenerate: z.boolean().optional(),
    editMessageId: z.string().refine(mongoose.isValidObjectId, 'Invalid message id').optional(),
    tone: z.enum(TONE_IDS).optional(),
  })
  .refine((b) => b.regenerate || b.content, { message: 'content is required', path: ['content'] })
  .refine((b) => !(b.regenerate && b.editMessageId), { message: 'regenerate and editMessageId are exclusive', path: ['editMessageId'] });
const idParam = z.object({
  id: z.string().refine(mongoose.isValidObjectId, 'Invalid conversation id'),
});

/**
 * POST /api/conversations/:id/messages
 * Streams the assistant reply as Server-Sent Events:
 *   event: user_message | start | retry | token | done | title | error
 * Body: { content } for a new turn, { regenerate: true, tone? } to re-answer
 * the last user prompt (Retry / regenerate-in-tone), or
 * { content, editMessageId } to rewrite an earlier prompt and re-run from there.
 * Closing the HTTP connection aborts the upstream model request.
 */
chatRouter.post(
  '/conversations/:id/messages',
  validate(idParam, 'params'),
  validate(bodySchema),
  async (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();

    const emit = (event, data) => {
      if (res.writableEnded) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // Abort the upstream model call if the client goes away mid-stream.
    // Note: listen on `res`, not `req` – req 'close' fires as soon as the
    // request body has been consumed on modern Node.
    const controller = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) controller.abort();
    });

    // Heartbeat keeps proxies from closing an idle stream while the model thinks.
    const heartbeat = setInterval(() => !res.writableEnded && res.write(': ping\n\n'), 15000);

    try {
      await sendMessage({
        conversationId: req.params.id,
        content: req.body.content,
        regenerate: req.body.regenerate === true,
        editMessageId: req.body.editMessageId,
        tone: req.body.tone,
        signal: controller.signal,
        emit,
      });
    } catch (err) {
      console.error('[chat] generation failed', err);
      emit('error', { status: err.status ?? 500, message: err.message ?? 'Generation failed' });
    } finally {
      clearInterval(heartbeat);
      res.end();
    }
  },
);
