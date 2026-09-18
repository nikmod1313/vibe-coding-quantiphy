import mongoose from 'mongoose';
import { TONE_IDS, DEFAULT_TONE } from '../services/tone.js';

const MessageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    // Tone that was active when this message was produced (assistant messages).
    tone: { type: String, enum: TONE_IDS },
    // Generation metadata – populated for assistant messages.
    meta: {
      model: String,
      provider: String,
      latencyMs: Number,
      inputTokens: Number,
      outputTokens: Number,
      stopped: { type: Boolean, default: false }, // user aborted mid-stream
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const ConversationSchema = new mongoose.Schema(
  {
    title: { type: String, default: 'New conversation', trim: true, maxlength: 120 },
    tone: { type: String, enum: TONE_IDS, default: DEFAULT_TONE },
    titleGenerated: { type: Boolean, default: false },
    messages: { type: [MessageSchema], default: [] },
  },
  { timestamps: true },
);

ConversationSchema.index({ updatedAt: -1 });

/** Lightweight projection for the sidebar list. */
ConversationSchema.statics.listSummaries = function (filter = {}) {
  return this.aggregate([
    { $match: filter },
    { $sort: { updatedAt: -1 } },
    {
      $project: {
        title: 1,
        tone: 1,
        createdAt: 1,
        updatedAt: 1,
        messageCount: { $size: '$messages' },
        preview: {
          $ifNull: [{ $substrCP: [{ $last: '$messages.content' }, 0, 90] }, ''],
        },
      },
    },
  ]);
};

export const Conversation = mongoose.model('Conversation', ConversationSchema);
