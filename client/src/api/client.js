/**
 * Thin API layer. The client never contains business logic – it only calls
 * the server and translates the SSE stream into callbacks.
 */
const BASE = '/api';

const request = async (path, options = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
};

export const api = {
  health: () => request('/health'),
  tones: () => request('/tones'),
  listConversations: (q) => request(`/conversations${q ? `?q=${encodeURIComponent(q)}` : ''}`).then((d) => d.conversations),
  createConversation: (tone) => request('/conversations', { method: 'POST', body: { tone } }).then((d) => d.conversation),
  getConversation: (id) => request(`/conversations/${id}`).then((d) => d.conversation),
  updateConversation: (id, patch) => request(`/conversations/${id}`, { method: 'PATCH', body: patch }).then((d) => d.conversation),
  deleteConversation: (id) => request(`/conversations/${id}`, { method: 'DELETE' }),
};

/**
 * Streams an assistant reply. Parses `event:`/`data:` SSE frames from a fetch
 * body so we can POST a JSON body (EventSource only supports GET).
 *
 * @param {object} args
 * @param {string} args.conversationId
 * @param {string} args.content
 * @param {string} [args.tone]
 * @param {AbortSignal} [args.signal]
 * @param {(event: string, data: any) => void} args.onEvent
 */
export const streamMessage = async ({ conversationId, content, regenerate, tone, signal, onEvent }) => {
  const res = await fetch(`${BASE}/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(regenerate ? { regenerate: true, tone } : { content, tone }),
    signal,
  });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Request failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const dispatch = (frame) => {
    let event = 'message';
    const dataLines = [];
    for (const line of frame.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
    }
    if (!dataLines.length) return; // comment / heartbeat
    onEvent(event, JSON.parse(dataLines.join('\n')));
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      if (frame.trim()) dispatch(frame);
    }
  }
};
