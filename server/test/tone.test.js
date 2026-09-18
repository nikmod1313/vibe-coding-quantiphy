import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TONES, TONE_IDS, DEFAULT_TONE, isTone, listTones } from '../src/services/tone.js';
import { buildSystemPrompt } from '../src/services/prompt.js';

test('exposes exactly the three required tones', () => {
  assert.deepEqual([...TONE_IDS].sort(), ['casual', 'concise', 'professional']);
  assert.ok(isTone(DEFAULT_TONE));
});

test('public tone list never leaks the system instruction text', () => {
  for (const t of listTones()) {
    assert.deepEqual(Object.keys(t).sort(), ['description', 'id', 'label']);
  }
});

test('system prompt embeds the selected tone modifier and nothing else', () => {
  for (const id of TONE_IDS) {
    const prompt = buildSystemPrompt(id);
    assert.ok(prompt.includes(TONES[id].instruction), `${id} instruction present`);
    for (const other of TONE_IDS.filter((o) => o !== id)) {
      assert.ok(!prompt.includes(TONES[other].instruction), `${other} instruction absent`);
    }
  }
});

test('unknown tone is rejected', () => {
  assert.equal(isTone('sarcastic'), false);
  assert.throws(() => buildSystemPrompt('sarcastic'));
});
