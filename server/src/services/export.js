import { TONES } from './tone.js';

const fmt = (iso) => new Date(iso).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

/**
 * Renders a conversation as a portable Markdown transcript.
 * Pure function – easy to unit test and reuse (e.g. for email/share later).
 */
export const conversationToMarkdown = (convo) => {
  const lines = [
    `# ${convo.title}`,
    '',
    `- Exported: ${fmt(new Date())}`,
    `- Created: ${fmt(convo.createdAt)}`,
    `- Active tone: ${TONES[convo.tone]?.label ?? convo.tone}`,
    `- Messages: ${convo.messages.length}`,
    '',
    '---',
    '',
  ];

  for (const m of convo.messages) {
    if (m.role === 'user') {
      lines.push(`## 🧑 You · ${fmt(m.createdAt)}`, '', m.content, '');
    } else {
      const bits = [TONES[m.tone]?.label ?? m.tone, m.meta?.model, m.meta?.latencyMs != null ? `${(m.meta.latencyMs / 1000).toFixed(1)}s` : null, m.meta?.stopped ? 'stopped early' : null].filter(Boolean);
      lines.push(`## 🤖 Assistant · ${fmt(m.createdAt)}`, '', `> _${bits.join(' · ')}_`, '', m.content, '');
    }
  }

  return lines.join('\n');
};

/** Safe, readable filename derived from the title. */
export const exportFilename = (convo) => {
  const slug = String(convo.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || 'conversation';
  return `${slug}.md`;
};
