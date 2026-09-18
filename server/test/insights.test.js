import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDigest, parseCards } from '../src/services/insights.js';

test('digest numbers conversations and trims long messages', () => {
  const d = buildDigest([
    { title: 'SSE', tone: 'concise', messages: [{ role: 'user', content: 'x'.repeat(2000) }, { role: 'assistant', content: 'short' }] },
  ]);
  assert.match(d, /### Conversation 0 — "SSE" \(tone: Concise\)/);
  assert.ok(d.length < 1000);
});

test('parses fenced JSON and clamps fields', () => {
  const raw = '```json\n{"headline":"h","cards":[{"topic":"T","takeaway":"a","insight":"b","question":"q","conversationIndex":0}]}\n```';
  const r = parseCards(raw);
  assert.equal(r.cards.length, 1);
  assert.equal(r.cards[0].conversationIndex, 0);
});

test('rejects output without cards', () => {
  assert.throws(() => parseCards('{"cards":[]}'));
  assert.throws(() => parseCards('no json here'));
});
