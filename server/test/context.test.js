import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectContext, estimateTokens } from '../src/services/context.js';

const msg = (role, chars) => ({ role, content: 'x'.repeat(chars) });

test('keeps everything when under budget', () => {
  const r = selectContext([msg('user', 40), msg('assistant', 40), msg('user', 40)]);
  assert.equal(r.messages.length, 3);
  assert.equal(r.dropped, 0);
});

test('drops oldest turns first when over budget and always keeps the latest user turn', () => {
  const thread = [msg('user', 4000), msg('assistant', 4000), msg('user', 4000), msg('assistant', 4000), msg('user', 4000)];
  const r = selectContext(thread, { budget: 2500 });
  assert.equal(r.messages.length, 1);
  assert.equal(r.messages[0].role, 'user');
  assert.equal(r.dropped, 4);
});

test('never starts history with an assistant turn', () => {
  const thread = [msg('user', 400), msg('assistant', 400), msg('user', 400)];
  const r = selectContext(thread, { budget: estimateTokens('x'.repeat(400)) * 2 + 8 });
  assert.equal(r.messages[0].role, 'user');
  assert.equal(r.messages.length, 1);
});

test('respects the message cap', () => {
  const thread = Array.from({ length: 100 }, (_, i) => msg(i % 2 ? 'assistant' : 'user', 10));
  const r = selectContext(thread, { maxMessages: 10 });
  assert.ok(r.messages.length <= 10);
  assert.equal(r.messages[0].role, 'user');
});
