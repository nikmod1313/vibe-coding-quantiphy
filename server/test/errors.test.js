import { test } from 'node:test';
import assert from 'node:assert/strict';
import { humanizeProviderError } from '../src/services/chat.js';

test('maps transient provider statuses to friendly copy', () => {
  assert.match(humanizeProviderError({ status: 503 }), /heavy load/);
  assert.match(humanizeProviderError({ status: 429 }), /Rate limit/);
  assert.match(humanizeProviderError({ status: 401 }), /API key/);
});

test('unwraps nested JSON error bodies without leaking raw payloads', () => {
  const nested = JSON.stringify({ error: { message: JSON.stringify({ error: { message: 'Model overloaded' } }) } });
  assert.equal(humanizeProviderError({ message: nested }), 'Model overloaded');
});
