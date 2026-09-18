import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conversationToMarkdown, exportFilename } from '../src/services/export.js';

const convo = {
  title: 'Why the Sky Is Blue?!',
  tone: 'concise',
  createdAt: '2026-09-18T04:00:00.000Z',
  messages: [
    { role: 'user', content: 'Why is the sky blue?', createdAt: '2026-09-18T04:00:01.000Z' },
    { role: 'assistant', content: 'Rayleigh scattering.', tone: 'concise', createdAt: '2026-09-18T04:00:03.000Z', meta: { model: 'gemini-3.6-flash', latencyMs: 1234, stopped: false } },
  ],
};

test('markdown transcript contains title, both turns and assistant metadata', () => {
  const md = conversationToMarkdown(convo);
  assert.ok(md.startsWith('# Why the Sky Is Blue?!'));
  assert.match(md, /## 🧑 You/);
  assert.match(md, /## 🤖 Assistant/);
  assert.match(md, /Concise · gemini-3\.6-flash · 1\.2s/);
  assert.match(md, /Rayleigh scattering\./);
});

test('export filename is a safe slug', () => {
  assert.equal(exportFilename(convo), 'why-the-sky-is-blue.md');
  assert.equal(exportFilename({ title: '///' }), 'conversation.md');
});
