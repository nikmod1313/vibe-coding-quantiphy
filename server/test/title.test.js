import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heuristicTitle } from '../src/services/title.js';

test('heuristic title drops filler words and caps length', () => {
  assert.equal(heuristicTitle('Can you explain how Server-Sent Events work in the browser?'), 'Server-Sent Events Work Browser');
  assert.equal(heuristicTitle('Why is the sky blue?'), 'Why Is The Sky Blue'); // too few keywords → keep the sentence
  assert.ok(heuristicTitle('x '.repeat(100)).length <= 60);
  assert.equal(heuristicTitle(''), 'New conversation');
});
