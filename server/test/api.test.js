/**
 * HTTP-level tests against the Express app with the DB and AI provider mocked
 * out, so they run without MongoDB or an API key.
 */
import { test, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';

process.env.AI_PROVIDER = 'gemini';
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key';

const { createApp } = await import('../src/app.js');
const { Conversation } = await import('../src/models/Conversation.js');

let server;
let base;

before(async () => {
  const app = createApp();
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const json = (path, init) =>
  fetch(`${base}${path}`, { headers: { 'Content-Type': 'application/json' }, ...init });

test('GET /api/tones lists presets without instructions', async () => {
  const res = await json('/api/tones');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.tones.length, 3);
  assert.ok(body.tones.every((t) => !('instruction' in t)));
});

test('health never exposes the API key', async () => {
  const res = await json('/api/health');
  const text = await res.text();
  assert.ok(!text.includes(process.env.GEMINI_API_KEY));
  assert.equal(res.headers.get('x-powered-by'), null);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
});

test('rejects NoSQL operator objects and empty content', async () => {
  const id = '6aacb714e5e82b58a4a8c5cc';
  let res = await json(`/api/conversations/${id}/messages`, { method: 'POST', body: JSON.stringify({ content: { $gt: '' } }) });
  assert.equal(res.status, 400);
  res = await json(`/api/conversations/${id}/messages`, { method: 'POST', body: JSON.stringify({ content: '   ' }) });
  assert.equal(res.status, 400);
  res = await json(`/api/conversations/${id}/messages`, { method: 'POST', body: JSON.stringify({ content: 'hi', tone: 'sarcastic' }) });
  assert.equal(res.status, 400);
});

test('rejects malformed conversation ids', async () => {
  const res = await json('/api/conversations/not-an-id');
  assert.equal(res.status, 400);
});

test('search query is regex-escaped before hitting the database', async () => {
  const spy = mock.method(Conversation, 'listSummaries', async () => []);
  const res = await json('/api/conversations?q=.*(');
  assert.equal(res.status, 200);
  const filter = spy.mock.calls[0].arguments[0];
  assert.equal(filter.$or[0].title.$regex, '\\.\\*\\(');
  spy.mock.restore();
});

test('search query length is capped', async () => {
  const res = await json(`/api/conversations?q=${'a'.repeat(101)}`);
  assert.equal(res.status, 400);
});
